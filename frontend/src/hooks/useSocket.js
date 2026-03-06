/**
 * useSocket — WebSocket hook with reconnection logic.
 *
 * Follows the custom-hook pattern: encapsulates connection lifecycle,
 * exposes a stable `send` function and `connected` status.
 */
import { useEffect, useRef, useCallback, useState } from 'react';

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 3000;

// In production, connect to the backend origin; in dev, fall back to localhost:8000
const WS_BASE = import.meta.env.VITE_WS_URL || null;

const useSocket = (roomCode, playerName, onMessage) => {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const onMessageRef = useRef(onMessage);
  const closedIntentionally = useRef(false);

  // Keep callback ref fresh without triggering reconnects
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!roomCode || !playerName) return;
    closedIntentionally.current = false;

    const connect = () => {
      if (closedIntentionally.current) return;

      let url;
      if (WS_BASE) {
        // Use explicit env var (e.g. wss://my-backend.onrender.com)
        url = `${WS_BASE}/ws/${roomCode}/${encodeURIComponent(playerName)}`;
      } else {
        // Dev fallback
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        url = `${protocol}//localhost:8000/ws/${roomCode}/${encodeURIComponent(playerName)}`;
      }

      const socket = new WebSocket(url);
      ws.current = socket;

      socket.onopen = () => {
        setConnected(true);
        reconnectAttempts.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          onMessageRef.current(msg);
        } catch (err) {
          console.error('Failed to parse WS message:', err);
        }
      };

      socket.onerror = () => setConnected(false);

      socket.onclose = (event) => {
        setConnected(false);

        // Server rejected (room not found)
        if (event.code === 4004 || event.code === 403) {
          onMessageRef.current({
            type: 'connection_failed',
            reason: event.reason || 'Room not found.',
          });
          return;
        }

        if (!closedIntentionally.current && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current += 1;
          setTimeout(connect, RECONNECT_DELAY_MS);
        } else if (!closedIntentionally.current) {
          onMessageRef.current({
            type: 'connection_failed',
            reason: `Could not connect after ${MAX_RECONNECT_ATTEMPTS} attempts.`,
          });
        }
      };
    };

    connect();

    return () => {
      closedIntentionally.current = true;
      ws.current?.close();
    };
  }, [roomCode, playerName]);

  const send = useCallback((message) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  return { send, connected };
};

export default useSocket;
