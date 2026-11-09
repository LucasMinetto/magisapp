/**
 * Protocolo de sincronização entre app mobile e desktop.
 * Versão do protocolo: 1
 * Header obrigatório: X-Protocol-Version: 1
 */

export const PROTOCOL_VERSION = 1;
export const PROTOCOL_HEADER = 'X-Protocol-Version';

export type SyncMessageType =
  | 'pull_request'
  | 'pull_response'
  | 'push_request'
  | 'push_response'
  | 'delta'
  | 'ack'
  | 'error'
  | 'heartbeat'
  | 'heartbeat_ack';

export interface BaseMessage {
  type: SyncMessageType;
  requestId: string;
  timestamp: string; // ISO 8601
}

export interface PullRequest extends BaseMessage {
  type: 'pull_request';
  campaignId: string;
  userId: string;
  since?: string; // ISO timestamp for incremental sync
}

export interface PullResponse extends BaseMessage {
  type: 'pull_response';
  ficha?: unknown;
  biblioteca?: {
    rituais: unknown[];
    itens: unknown[];
  };
  regras?: unknown[];
  arquivo?: {
    pessoas: unknown[];
    lugares: unknown[];
    anotacoes: unknown[];
    historico: unknown[];
  };
  rolagens?: unknown[];
  serverTimestamp: string;
}

export interface PushRequest extends BaseMessage {
  type: 'push_request';
  campaignId: string;
  userId: string;
  changes: SyncChange[];
}

export interface SyncChange {
  entityType: 'ficha' | 'rolagem' | 'anotacao' | 'pessoa' | 'lugar';
  operation: 'create' | 'update' | 'delete';
  entityId: string;
  data: unknown;
  timestamp: string;
  version: number;
}

export interface PushResponse extends BaseMessage {
  type: 'push_response';
  accepted: string[]; // entityIds
  rejected: { entityId: string; reason: string }[];
  serverTimestamp: string;
}

export interface DeltaMessage extends BaseMessage {
  type: 'delta';
  campaignId: string;
  changes: SyncChange[];
}

export interface AckMessage extends BaseMessage {
  type: 'ack';
  originalRequestId: string;
  success: boolean;
}

export interface ErrorMessage extends BaseMessage {
  type: 'error';
  code: string;
  message: string;
  details?: unknown;
}

export interface HeartbeatMessage extends BaseMessage {
  type: 'heartbeat';
}

export interface HeartbeatAckMessage extends BaseMessage {
  type: 'heartbeat_ack';
}

export type SyncMessage =
  | PullRequest
  | PullResponse
  | PushRequest
  | PushResponse
  | DeltaMessage
  | AckMessage
  | ErrorMessage
  | HeartbeatMessage
  | HeartbeatAckMessage;

export function createRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isPullRequest(msg: SyncMessage): msg is PullRequest {
  return msg.type === 'pull_request';
}

export function isPushRequest(msg: SyncMessage): msg is PushRequest {
  return msg.type === 'push_request';
}

export function isDeltaMessage(msg: SyncMessage): msg is DeltaMessage {
  return msg.type === 'delta';
}

export function isErrorMessage(msg: SyncMessage): msg is ErrorMessage {
  return msg.type === 'error';
}