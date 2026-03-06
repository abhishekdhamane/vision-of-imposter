/**
 * useSocket — WebSocket hook with reconnection logic.
 *
 * Follows the custom-hook pattern: encapsulates connection lifecycle,
 * exposes a stable `send` function and `connected` status.
 */
import { useEffect, useRef, useCallback, useState } from 'react';

const WS_PORT = 8000;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 3000;

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

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//localhost:${WS_PORT}/ws/${roomCode}/${encodeURIComponent(playerName)}`;

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
