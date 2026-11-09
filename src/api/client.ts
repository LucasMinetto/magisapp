/**
 * API Client: fetch wrapper + WebSocket com reconexão e heartbeat.
 * Assume endpoints do desktop:
 *   GET  /api/sync/pull?campaignId&userId
 *   POST /api/sync/push
 *   WS   ws://host/sync?token=<jwt>
 */

import {
  SyncMessage,
  PullRequest,
  PullResponse,
  PushRequest,
  PushResponse,
  DeltaMessage,
  AckMessage,
  ErrorMessage,
  HeartbeatMessage,
  HeartbeatAckMessage,
  PROTOCOL_VERSION,
  PROTOCOL_HEADER,
  createRequestId,
} from './protocol';

export { PROTOCOL_VERSION, PROTOCOL_HEADER, createRequestId, type SyncMessage } from './protocol';

export interface ApiClientConfig {
  baseUrl: string;
  getToken: () => string | null;
  onMessage?: (msg: SyncMessage) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
  onOpen?: () => void;
}

export interface FetchOptions extends RequestInit {
  timeout?: number;
}

const DEFAULT_TIMEOUT = 10000;
const HEARTBEAT_INTERVAL = 30000;
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const RECONNECT_JITTER = 0.3;

function buildHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [PROTOCOL_HEADER]: String(PROTOCOL_VERSION),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT, signal, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const finalSignal = signal
    ? (() => {
        const c = new AbortController();
        signal.addEventListener('abort', () => c.abort());
        controller.signal.addEventListener('abort', () => c.abort());
        return c.signal;
      })()
    : controller.signal;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: finalSignal,
    });
    return response;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

export class ApiClient {
  private config: ApiClientConfig;
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pendingRequests = new Map<string, { resolve: (value: SyncMessage) => void; reject: (reason: Error) => void }>();
  private isIntentionalClose = false;

  constructor(config: ApiClientConfig) {
    this.config = config;
  }

  // --- REST ---

  async pull(campaignId: string, userId: string, since?: string): Promise<PullResponse> {
    const token = this.config.getToken();
    const params = new URLSearchParams({ campaignId, userId });
    if (since) params.set('since', since);

    const response = await fetchWithTimeout(`${this.config.baseUrl}/api/sync/pull?${params}`, {
      method: 'GET',
      headers: buildHeaders(token),
    });

    if (!response.ok) {
      throw new Error(`Pull failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as PullResponse;
  }

  async push(campaignId: string, userId: string, changes: PushRequest['changes']): Promise<PushResponse> {
    const token = this.config.getToken();
    const requestId = createRequestId();

    const payload: PushRequest = {
      type: 'push_request',
      requestId,
      timestamp: new Date().toISOString(),
      campaignId,
      userId,
      changes,
    };

    const response = await fetchWithTimeout(`${this.config.baseUrl}/api/sync/push`, {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Push failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as PushResponse;
  }

  // --- WebSocket ---

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const token = this.config.getToken();
    if (!token) {
      this.config.onError?.(new Error('No auth token for WebSocket'));
      return;
    }

    const wsUrl = this.config.baseUrl.replace(/^http/, 'ws') + `/sync?token=${encodeURIComponent(token)}`;
    this.isIntentionalClose = false;

    try {
      this.ws = new WebSocket(wsUrl);
      this.setupWebSocket();
    } catch (e) {
      this.config.onError?.(e as Error);
      this.scheduleReconnect();
    }
  }

  private setupWebSocket(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.startHeartbeat();
      this.config.onOpen?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as SyncMessage;
        this.handleMessage(msg);
      } catch (e) {
        this.config.onError?.(new Error(`Invalid WS message: ${(e as Error).message}`));
      }
    };

    this.ws.onerror = (event) => {
      this.config.onError?.(new Error('WebSocket error'));
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.config.onClose?.();
      if (!this.isIntentionalClose) {
        this.scheduleReconnect();
      }
    };
  }

  private handleMessage(msg: SyncMessage): void {
    // Resolve pending request
    if (msg.type === 'ack' || msg.type === 'pull_response' || msg.type === 'push_response' || msg.type === 'error') {
      const pending = this.pendingRequests.get(msg.requestId);
      if (pending) {
        this.pendingRequests.delete(msg.requestId);
        if (msg.type === 'error') {
          pending.reject(new Error(msg.message));
        } else {
          pending.resolve(msg);
        }
        return;
      }
    }

    // Forward to handler
    this.config.onMessage?.(msg);
  }

  send(msg: SyncMessage): Promise<SyncMessage> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      this.pendingRequests.set(msg.requestId, { resolve, reject });
      this.ws.send(JSON.stringify(msg));

      // Timeout for response
      setTimeout(() => {
        if (this.pendingRequests.has(msg.requestId)) {
          this.pendingRequests.delete(msg.requestId);
          reject(new Error('Request timeout'));
        }
      }, 15000);
    });
  }

  async pullWS(campaignId: string, userId: string, since?: string): Promise<PullResponse> {
    const msg: PullRequest = {
      type: 'pull_request',
      requestId: createRequestId(),
      timestamp: new Date().toISOString(),
      campaignId,
      userId,
      since,
    };
    const response = await this.send(msg);
    return response as PullResponse;
  }

  async pushWS(campaignId: string, userId: string, changes: PushRequest['changes']): Promise<PushResponse> {
    const msg: PushRequest = {
      type: 'push_request',
      requestId: createRequestId(),
      timestamp: new Date().toISOString(),
      campaignId,
      userId,
      changes,
    };
    const response = await this.send(msg);
    return response as PushResponse;
  }

  disconnect(): void {
    this.isIntentionalClose = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.pendingRequests.forEach(({ reject }) => reject(new Error('Disconnected')));
    this.pendingRequests.clear();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        const msg: HeartbeatMessage = {
          type: 'heartbeat',
          requestId: createRequestId(),
          timestamp: new Date().toISOString(),
        };
        this.ws.send(JSON.stringify(msg));
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempt) +
        Math.random() * RECONNECT_BASE_DELAY * RECONNECT_JITTER,
      RECONNECT_MAX_DELAY
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempt++;
      this.connect();
    }, delay);
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton factory
let _apiClient: ApiClient | null = null;

export function createApiClient(config: ApiClientConfig): ApiClient {
  _apiClient = new ApiClient(config);
  return _apiClient;
}

export function getApiClient(): ApiClient | null {
  return _apiClient;
}