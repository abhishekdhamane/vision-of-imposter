from typing import Dict, Set, Callable, Tuple
from fastapi import WebSocket
import json

class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}  # room_code -> set of websockets
        self.player_to_room: Dict[WebSocket, str] = {}  # websocket -> room_code
        self.player_to_ws: Dict[Tuple[str, str], WebSocket] = {}  # (room_code, player_id) -> websocket
    
    async def connect(self, websocket: WebSocket, room_code: str, player_id: str):
        """Accept connection and add to room group."""
        await websocket.accept()
        if room_code not in self.active_connections:
            self.active_connections[room_code] = set()
        self.active_connections[room_code].add(websocket)
        self.player_to_room[websocket] = room_code
        self.player_to_ws[(room_code, player_id)] = websocket
    
    def disconnect(self, websocket: WebSocket, room_code: str = None, player_id: str = None):
        """Remove connection from room group."""
        if room_code and player_id:
            self.player_to_ws.pop((room_code, player_id), None)
        
        if not room_code:
            room_code = self.player_to_room.pop(websocket, None)
        else:
            self.player_to_room.pop(websocket, None)
            
        if room_code and room_code in self.active_connections:
            self.active_connections[room_code].discard(websocket)
            if not self.active_connections[room_code]:
                del self.active_connections[room_code]
    
    async def broadcast_to_room(self, room_code: str, message: dict):
        """Send message to all players in a room."""
        if room_code in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[room_code]:
                try:
                    await connection.send_json(message)
                except Exception:
                    disconnected.add(connection)
            
            # Clean up disconnected clients
            for conn in disconnected:
                self.disconnect(conn)
    
    async def send_to_player(self, websocket: WebSocket, message: dict):
        """Send message to specific player."""
        try:
            await websocket.send_json(message)
        except Exception:
            room_code = self.player_to_room.get(websocket)
            if room_code:
                self.disconnect(websocket)
    
    async def send_to_player_by_id(self, room_code: str, player_id: str, message: dict):
        """Send message to specific player by ID."""
        websocket = self.player_to_ws.get((room_code, player_id))
        if websocket:
            try:
                await websocket.send_json(message)
            except Exception:
                self.disconnect(websocket, room_code, player_id)
    
    def get_room_player_count(self, room_code: str) -> int:
        """Get number of connected players in room."""
        return len(self.active_connections.get(room_code, set()))
