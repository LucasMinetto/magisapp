import { useCallback } from 'react';
import { toBase64, fromBase64 } from '../lib/base64';

export interface QRCodePayload {
  serverUrl: string;
  username: string;
  password: string;
  campaignId: string;
}

export interface ParsedQRResult {
  success: boolean;
  payload?: QRCodePayload;
  error?: string;
}

/**
 * Encodes a QR code payload to base64 JSON string
 */
export function encodeQRPayload(payload: QRCodePayload): string {
  const json = JSON.stringify(payload);
  return toBase64(json);
}

/**
 * Decodes a base64 JSON string to QR code payload
 */
export function decodeQRPayload(base64: string): ParsedQRResult {
  try {
    const json = fromBase64(base64);
    const payload = JSON.parse(json) as QRCodePayload;

    // Validate required fields
    if (!payload.serverUrl || !payload.username || !payload.password || !payload.campaignId) {
      return { success: false, error: 'QR code missing required fields' };
    }

    // Validate URL format
    try {
      new URL(payload.serverUrl);
    } catch {
      return { success: false, error: 'Invalid server URL format' };
    }

    return { success: true, payload };
  } catch {
    return { success: false, error: 'Invalid QR code format' };
  }
}

/**
 * Hook for QR code encoding/decoding operations
 */
export function useQRCode() {
  const encode = useCallback((payload: QRCodePayload): string => {
    return encodeQRPayload(payload);
  }, []);

  const decode = useCallback((base64: string): ParsedQRResult => {
    return decodeQRPayload(base64);
  }, []);

  return { encode, decode };
}

/**
 * Deep link URL scheme
 */
export const DEEP_LINK_SCHEME = 'magistrado';

/**
 * Builds a deep link URL for sync QR code
 */
export function buildDeepLinkUrl(base64Payload: string): string {
  const encoded = encodeURIComponent(base64Payload);
  return `${DEEP_LINK_SCHEME}://sync?data=${encoded}`;
}

/**
 * Parses a deep link URL and extracts the QR payload
 */
export function parseDeepLinkUrl(url: string): ParsedQRResult {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== `${DEEP_LINK_SCHEME}:`) {
      return { success: false, error: 'Invalid deep link scheme' };
    }

    const data = urlObj.searchParams.get('data');
    if (!data) {
      return { success: false, error: 'No data parameter in deep link' };
    }

    const base64 = decodeURIComponent(data);
    return decodeQRPayload(base64);
  } catch {
    return { success: false, error: 'Invalid deep link URL' };
  }
}