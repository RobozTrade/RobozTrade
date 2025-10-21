import { useEffect, useRef, useCallback } from 'react';
import { useMarketStore } from '../stores/marketStore';
import type { WebSocketMessage, SubscribeMessage } from '@roboz-trade/shared-types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8787/ws';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const updatePrice = useMarketStore((state) => state.updatePrice);
  const updateTicker = useMarketStore((state) => state.updateTicker);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        if (message.type === 'ticker') {
          const data = message.data;
          if (data.e === '24hrTicker') {
            updatePrice(data.s, parseFloat(data.c));
            updateTicker(data.s, {
              symbol: data.s,
              price: parseFloat(data.c),
              change24h: parseFloat(data.P),
              volume24h: parseFloat(data.v),
              high24h: parseFloat(data.h),
              low24h: parseFloat(data.l),
              timestamp: data.E,
            });
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      // Attempt to reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    };
  }, [updatePrice, updateTicker]);

  const subscribe = useCallback((channels: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: SubscribeMessage = {
        action: 'subscribe',
        channels,
      };
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const unsubscribe = useCallback((channels: string[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: SubscribeMessage = {
        action: 'unsubscribe',
        channels,
      };
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { subscribe, unsubscribe };
}

