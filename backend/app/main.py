from fastapi import FastAPI, WebSocket, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import json
from typing import Dict
from datetime import datetime
from .models import Room, Player, GamePhase, GameState, ChatMessage
from .game_logic import GameLogic
from .websocket_manager import WebSocketManager
from pydantic import BaseModel

app = FastAPI(title="Vision of Imposter")

# CORS setup - Must be before other middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for WebSocket during dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Optional: Add manual CORS response headers
@app.middleware("http")
async def add_cors_headers(request, call_next):
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

# Global state
rooms: Dict[str, GameState] = {}
manager = WebSocketManager()

# Request models
class CreateRoomRequest(BaseModel):
    host_name: str

class ConfigRoomRequest(BaseModel):
    imposter_count: int = 1
    total_rounds: int = 3
    chat_duration: int = 120

# ==================== REST ENDPOINTS ====================

@app.get("/")
async def root():
    return {"message": "Vision of Imposter API"}

@app.post("/room/create")
async def create_room(request: CreateRoomRequest):
    """Create a new room and return room code."""
    room = Room(host_id="")  # Will be set when host joins
    game_state = GameState(room=room)
    rooms[room.code] = game_state
    
    return {
        "success": True,
        "room_code": room.code,
        "message": f"Room created. Share code: {room.code}"
    }

@app.get("/room/{room_code}")
async def get_room_info(room_code: str):
    """Get room info."""
    if room_code not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    game_state = rooms[room_code]
    room = game_state.room
    
    return {
        "code": room.code,
        "host_id": room.host_id,
        "players": [p.to_dict(include_role=False) for p in room.players.values()],
        "player_count": len(room.players),
        "game_phase": room.game_phase.value,
        "current_round": room.current_round,
    }

@app.post("/room/{room_code}/config")
async def configure_room(room_code: str, request: ConfigRoomRequest):
    """Configure room settings (host only)."""
    if room_code not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room = rooms[room_code].room
    room.imposter_count = max(1, request.imposter_count)
    room.total_rounds_before_voting = max(1, request.total_rounds)
    room.chat_duration = max(30, request.chat_duration)
    
    return {"success": True, "message": "Room configured"}

# ==================== WEBSOCKET ENDPOINTS ====================

@app.websocket("/ws/{room_code}/{player_name}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, player_name: str):
    """Main WebSocket connection for game events."""
    
    print(f"WebSocket connection attempt: room_code={room_code}, player_name={player_name}")
    print(f"Available rooms: {list(rooms.keys())}")
    
    if room_code not in rooms:
        print(f"Room {room_code} not found! Closing connection.")
        # Must accept before we can send a close code the client can read
        await websocket.accept()
        await websocket.close(code=4004, reason="Room not found")
        return
    
    # Create player
    player = Player(name=player_name)
    rooms[room_code].room.players[player.id] = player
    
    # If first player, set as host
    if rooms[room_code].room.host_id == "":
        rooms[room_code].room.host_id = player.id
        player.is_host = True
    
    print(f"Player {player_name} {player.id} connecting to room {room_code}")
    
    await manager.connect(websocket, room_code, player.id)
    
    try:
        game_room = rooms[room_code].room
        # Send newly connected player the current room state and existing players
        await manager.send_to_player(websocket, {
            "type": "room_state",
            "players": [p.to_dict(include_role=False) for p in game_room.players.values()],
            "your_player_id": player.id,
            "game_phase": game_room.game_phase.value,
            "is_host": player.is_host
        })
                # Notify others about new player
        await manager.broadcast_to_room(room_code, {
            "type": "player_joined",
            "player": player.to_dict(include_role=False),
            "total_players": len(rooms[room_code].room.players)
        })
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            await handle_message(message, player, room_code, websocket)
    
    except Exception as e:
        print(f"WebSocket error: {e}")
    
    finally:
        print(f"Player {player_name} ({player.id}) disconnected from room {room_code}")
        manager.disconnect(websocket, room_code, player.id)
        if room_code in rooms:
            if player.id in rooms[room_code].room.players:
                del rooms[room_code].room.players[player.id]
            
            remaining = len(rooms[room_code].room.players)
            print(f"Room {room_code} now has {remaining} players")
            
            if remaining > 0:
                await manager.broadcast_to_room(room_code, {
                    "type": "player_left",
                    "player_id": player.id,
                    "total_players": remaining
                })
            # Don't auto-delete rooms - they persist until server restart
            # This prevents reconnection issues from killing rooms

async def handle_message(message: dict, player: Player, room_code: str, websocket: WebSocket):
    """Route incoming messages based on type."""
    
    if room_code not in rooms:
        return
    
    game_state = rooms[room_code]
    room = game_state.room
    
    msg_type = message.get("type")
    
    if msg_type == "start_game":
        if player.id != room.host_id:
            await manager.send_to_player(websocket, {"type": "error", "message": "Only host can start"})
            return
        
        try:
            GameLogic.start_game(room)
            
            # Get the first drawer info
            first_drawer_id = room.get_current_drawer_id()
            first_drawer_name = room.players[first_drawer_id].name if first_drawer_id else 'Unknown'
            
            # Broadcast game started with first drawer info
            await manager.broadcast_to_room(room_code, {
                "type": "game_started",
                "round": room.current_round,
                "phase": room.game_phase.value,
                "first_drawer_id": first_drawer_id,
                "first_drawer_name": first_drawer_name,
                "round_progress": f"1/{len(room.player_order)}"
            })
            
            # Send individual words to each player
            for p_id, p in room.players.items():
                word = GameLogic.get_word_for_player(room, p)
                await manager.send_to_player_by_id(room_code, p_id, {
                    "type": "your_word",
                    "word": word,
                    "is_imposter": p.role.value == "imposter",
                    "player_id": p_id
                })
        
        except ValueError as e:
            await manager.send_to_player(websocket, {"type": "error", "message": str(e)})
    
    elif msg_type == "submit_drawing":
        # Verify it's the current drawer's turn
        if player.id != room.get_current_drawer_id():
            await manager.send_to_player(websocket, {"type": "error", "message": "Not your turn to draw"})
            return
        
        line_data = message.get("line_data")  # The line drawn by this player
        
        # Add line to shared board
        updated_drawing = GameLogic.add_line_to_shared_board(room, line_data)
        
        # Broadcast the updated board to all players
        await manager.broadcast_to_room(room_code, {
            "type": "drawing_updated",
            "drawing_data": updated_drawing,
            "drew_by": player.id,
            "player_name": player.name
        })
        
        # Check if all players have drawn
        has_more_players = GameLogic.next_drawer(room)
        
        if has_more_players:
            # Next player's turn
            next_drawer_id = room.get_current_drawer_id()
            await manager.broadcast_to_room(room_code, {
                "type": "next_drawer",
                "drawer_id": next_drawer_id,
                "drawing_data": updated_drawing,
                "round_progress": f"{room.current_drawer_index}/{len(room.player_order)}"
            })
        else:
            # All players have drawn - move to chat phase
            room.game_phase = GamePhase.CHAT
            await manager.broadcast_to_room(room_code, {
                "type": "all_drawings_submitted",
                "drawing_data": updated_drawing,
                "chat_duration": room.chat_duration
            })
    
    elif msg_type == "chat_message":
        message_text = message.get("message")
        chat_msg = ChatMessage(
            player_id=player.id,
            player_name=player.name,
            message=message_text,
            timestamp=datetime.now()
        )
        game_state.chat_messages.append(chat_msg)
        
        await manager.broadcast_to_room(room_code, {
            "type": "chat_message",
            "player_id": player.id,
            "player_name": player.name,
            "message": message_text,
            "timestamp": chat_msg.timestamp.isoformat()
        })
    
    elif msg_type == "end_chat":
        room.game_phase = GamePhase.VOTING
        await manager.broadcast_to_room(room_code, {
            "type": "voting_started",
            "round": room.current_round,
            "total_rounds": room.total_rounds_before_voting
        })
    
    elif msg_type == "submit_vote":
        voted_for = message.get("vote_for")
        # Initialize vote_for if it doesn't exist
        if not hasattr(player, 'vote_for'):
            player.vote_for = None
        player.vote_for = voted_for
        game_state.votes_submitted += 1
        
        # Check if all voted
        if game_state.votes_submitted == len(room.players):
            results = GameLogic.tally_votes(room)
            game_state.votes_submitted = 0
            
            await manager.broadcast_to_room(room_code, {
                "type": "voting_results",
                "imposter_voted_out": results["imposter_voted_out"],
                "imposter_ids": results["imposter_ids"],
                "most_voted_id": results.get("most_voted_id"),
                "vote_counts": results["vote_counts"],
                "winner": results["winner"]
            })
    
    elif msg_type == "next_round":
        if player.id != room.host_id:
            return
        
        GameLogic.next_round(room)
        
        if room.game_phase == GamePhase.DRAWING:
            await manager.broadcast_to_room(room_code, {
                "type": "new_round",
                "round": room.current_round,
                "phase": room.game_phase.value
            })
            
            # Send individual words to each player
            for p_id, p in room.players.items():
                word = GameLogic.get_word_for_player(room, p)
                await manager.send_to_player_by_id(room_code, p_id, {
                    "type": "your_word",
                    "word": word,
                    "is_imposter": p.role.value == "imposter",
                    "player_id": p_id
                })
    
    elif msg_type == "reset_game":
        if player.id != room.host_id:
            return
        
        GameLogic.reset_game(room)
        game_state.chat_messages = []
        
        await manager.broadcast_to_room(room_code, {
            "type": "game_reset",
            "message": "Game reset. Ready to start new game."
        })
