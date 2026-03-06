"""
WebSocket connection manager.

Handles connection lifecycle, room-scoped broadcasting, and targeted messaging.
"""

from __future__ import annotations

from typing import Dict, Set, Tuple
from fastapi import WebSocket


class WebSocketManager:
    """Manages WebSocket connections grouped by room."""

    def __init__(self) -> None:
        self._room_connections: Dict[str, Set[WebSocket]] = {}
        self._ws_to_room: Dict[WebSocket, str] = {}
        self._player_ws: Dict[Tuple[str, str], WebSocket] = {}  # (room, player_id) → ws

    # ── Connection Lifecycle ──────────────────────────────────────────────

    async def connect(self, ws: WebSocket, room_code: str, player_id: str) -> None:
        await ws.accept()
        self._room_connections.setdefault(room_code, set()).add(ws)
        self._ws_to_room[ws] = room_code
        self._player_ws[(room_code, player_id)] = ws

    def disconnect(self, ws: WebSocket, room_code: str | None = None, player_id: str | None = None) -> None:
        if room_code and player_id:
            self._player_ws.pop((room_code, player_id), None)

        if not room_code:
            room_code = self._ws_to_room.pop(ws, None)
        else:
            self._ws_to_room.pop(ws, None)

        if room_code and room_code in self._room_connections:
            self._room_connections[room_code].discard(ws)
            if not self._room_connections[room_code]:
                del self._room_connections[room_code]

    def get_ws_for_player(self, room_code: str, player_id: str) -> WebSocket | None:
        return self._player_ws.get((room_code, player_id))

    # ── Messaging ─────────────────────────────────────────────────────────

    async def broadcast(self, room_code: str, message: dict) -> None:
        """Send to every connection in a room."""
        connections = self._room_connections.get(room_code, set())
        dead: Set[WebSocket] = set()
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.disconnect(ws)

    async def send_to_ws(self, ws: WebSocket, message: dict) -> None:
        """Send to a specific WebSocket."""
        try:
            await ws.send_json(message)
        except Exception:
            room = self._ws_to_room.get(ws)
            if room:
                self.disconnect(ws)

    async def send_to_player(self, room_code: str, player_id: str, message: dict) -> None:
        """Send to a specific player by id."""
        ws = self._player_ws.get((room_code, player_id))
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(ws, room_code, player_id)

    def room_connection_count(self, room_code: str) -> int:
        return len(self._room_connections.get(room_code, set()))
