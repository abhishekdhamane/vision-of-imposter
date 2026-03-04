import { useEffect, useRef, useCallback, useState } from 'react';

const useSocket = (roomCode, playerName, onMessage) => {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  const onMessageRef = useRef(onMessage);
  const closedIntentionally = useRef(false);

  // Keep the ref up to date without triggering reconnects
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!roomCode || !playerName) return;

    closedIntentionally.current = false;

    const connectWebSocket = () => {
      // Don't reconnect if we intentionally closed
      if (closedIntentionally.current) return;
      
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      // Always connect to backend on port 8000
      const wsUrl = `${wsProtocol}//localhost:8000/ws/${roomCode}/${encodeURIComponent(playerName)}`;
      
      console.log('WebSocket connecting to:', wsUrl);
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket connected to:', wsUrl);
        setConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('WebSocket message received:', message);
        onMessageRef.current(message);
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      };

      ws.current.onclose = (event) => {
        console.log('WebSocket disconnected, code:', event.code, 'reason:', event.reason);
        setConnected(false);
        
        // Room not found (4004) or server rejected — don't retry, notify user
        if (event.code === 4004 || event.code === 403) {
          console.log('Room not found or rejected. Notifying user.');
          onMessageRef.current({ type: 'connection_failed', reason: event.reason || 'Room not found. It may have been lost due to server restart.' });
          return;
        }
        
        // Only attempt reconnect if not intentionally closed
        if (!closedIntentionally.current && reconnectAttempts.current < 5) {
          reconnectAttempts.current++;
          console.log(`Reconnect attempt ${reconnectAttempts.current}/5 in 3s...`);
          setTimeout(connectWebSocket, 3000);
        } else if (!closedIntentionally.current && reconnectAttempts.current >= 5) {
          onMessageRef.current({ type: 'connection_failed', reason: 'Could not connect to game server after 5 attempts.' });
        }
      };
    };

    connectWebSocket();

    return () => {
      closedIntentionally.current = true;
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [roomCode, playerName]);

  const send = useCallback((message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  return { send, connected, ws };
};

export default useSocket;
