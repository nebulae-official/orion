"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface WebSocketMessage {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface UseWebSocketOptions {
  url: string;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  onClose?: () => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  send: (data: unknown) => void;
  disconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    url,
    onMessage,
    onError,
    onOpen,
    onClose,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const backoffRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);

  // Keep refs up to date
  useEffect(() => {
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
  }, [onMessage, onError, onOpen, onClose]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        reconnectCountRef.current = 0;
        backoffRef.current = 0;
        onOpenRef.current?.();
      };

      ws.onmessage = (event: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const data = JSON.parse(event.data as string) as WebSocketMessage;
          setLastMessage(data);
          onMessageRef.current?.(data);
        } catch {
          // Non-JSON message; ignore
        }
      };

      ws.onerror = (event: Event) => {
        onErrorRef.current?.(event);
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        onCloseRef.current?.();

        // Auto-reconnect with exponential backoff + jitter
        if (reconnectCountRef.current < maxReconnectAttempts) {
          const delay = Math.min(
            reconnectInterval * Math.pow(2, backoffRef.current),
            30000
          ) + Math.random() * 1000;
          reconnectCountRef.current += 1;
          backoffRef.current += 1;
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      };
    } catch {
      // Connection failed; retry with exponential backoff + jitter
      if (reconnectCountRef.current < maxReconnectAttempts) {
        const delay = Math.min(
          reconnectInterval * Math.pow(2, backoffRef.current),
          30000
        ) + Math.random() * 1000;
        reconnectCountRef.current += 1;
        backoffRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, delay);
      }
    }
  }, [url, reconnectInterval, maxReconnectAttempts]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectCountRef.current = maxReconnectAttempts; // prevent reconnect
    wsRef.current?.close();
  }, [maxReconnectAttempts]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return { isConnected, lastMessage, send, disconnect };
}
