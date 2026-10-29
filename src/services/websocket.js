import { useEffect, useState } from 'react';

export function getWebSocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = import.meta.env.VITE_API_HOST || window.location.hostname || '127.0.0.1';
  const port = import.meta.env.VITE_API_PORT || '8000';
  return `${protocol}//${host}:${port}/ws`;
}

export const useSocket = (onMessageCallback = null) => {
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;
    let currentWs = null;

    const connect = () => {
      if (cancelled) return;
      const ws = new WebSocket(getWebSocketUrl());
      currentWs = ws;

      ws.onopen = () => console.log('WebSocket Connected');

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setMessages((prev) => [...prev.slice(-99), data]);
          if (onMessageCallback) onMessageCallback(data);
        } catch (err) {
          console.error('Failed to parse WS message:', err);
        }
      };

      ws.onclose = () => {
        if (!cancelled) {
          retryTimer = setTimeout(connect, 4000);
        }
      };

      ws.onerror = () => ws.close();

      setSocket(ws);
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      if (currentWs && (currentWs.readyState === WebSocket.OPEN || currentWs.readyState === WebSocket.CONNECTING)) {
        currentWs.close();
      }
    };
  }, [onMessageCallback]);

  return { socket, messages };
};
