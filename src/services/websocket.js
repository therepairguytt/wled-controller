import { useEffect, useState } from 'react';

export const useSocket = () => {
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const host = import.meta.env.VITE_APP_HOST || '127.0.0.1';
    const port = import.meta.env.VITE_APP_PORT || '8000';
    const url = `ws://${host}:${port}/ws`;

    const ws = new WebSocket(url);

    ws.onopen = () => console.log('WebSocket Connected');
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMessages((prev) => [...prev, data]);
      } catch (err) {
        console.error("Failed to parse WS message:", err);
      }
    };

    ws.onerror = (error) => console.error('WebSocket Error:', error);

    setSocket(ws);

    return () => {
      ws.close();
      console.log('WebSocket Disconnected');
    };
  }, []);

  return { socket, messages };
};