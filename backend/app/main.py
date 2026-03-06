"""
FastAPI application — REST endpoints + WebSocket handler registry.

Uses a handler-registry (Strategy) pattern instead of a giant if/elif chain.
Each message type maps to a dedicated async handler function.
"""

from __future__ import annotations

import json
from typing import Callable, Awaitable, Dict
from datetime import datetime

from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .models import (
    Room, Player, GamePhase, GameState, ChatMessage, MessageType, PlayerRole,
)
from .game_logic import GameService, GameFactory
from .websocket_manager import WebSocketManager


# ─── App / Middleware ─────────────────────────────────────────────────────────

app = FastAPI(title="Vision of Imposter")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Global State ────────────────────────────────────────────────────────────

rooms: Dict[str, GameState] = {}
manager = WebSocketManager()


# ─── Request Models ───────────────────────────────────────────────────────────

class CreateRoomRequest(BaseModel):
    host_name: str

class ConfigRoomRequest(BaseModel):
    imposter_count: int = 1
    total_rounds: int = 3
    chat_duration: int = 120


# ─── REST Endpoints ───────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "Vision of Imposter API"}


@app.post("/room/create")
async def create_room(request: CreateRoomRequest):
    room = GameFactory.create_room()
    rooms[room.code] = GameFactory.create_game_state(room)
    return {"success": True, "room_code": room.code}


@app.get("/room/{room_code}")
async def get_room_info(room_code: str):
    if room_code not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    gs = rooms[room_code]
    room = gs.room
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
    if room_code not in rooms:
        raise HTTPException(status_code=404, detail="Room not found")
    room = rooms[room_code].room
    room.imposter_count = max(1, request.imposter_count)
    room.total_rounds = max(1, request.total_rounds)
    room.chat_duration = max(30, request.chat_duration)
    return {"success": True}


# ═══════════════════════════════════════════════════════════════════════════════
# WebSocket
# ═══════════════════════════════════════════════════════════════════════════════

@app.websocket("/ws/{room_code}/{player_name}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, player_name: str):
    if room_code not in rooms:
        await websocket.accept()
        await websocket.close(code=4004, reason="Room not found")
        return

    room = rooms[room_code].room
    player = _resolve_player(room, player_name)

    # Handle reconnection
    old_ws = manager.get_ws_for_player(room_code, player.id)
    if old_ws:
        try:
            manager.disconnect(old_ws, room_code, player.id)
            await old_ws.close()
        except Exception:
            pass

    await manager.connect(websocket, room_code, player.id)

    try:
        # Send current state to the connecting player
        await manager.send_to_ws(websocket, {
            "type": MessageType.ROOM_STATE.value,
            "players": [p.to_dict(include_role=False) for p in room.players.values()],
            "your_player_id": player.id,
            "game_phase": room.game_phase.value,
            "is_host": player.is_host,
        })

        await manager.broadcast(room_code, {
            "type": MessageType.PLAYER_JOINED.value,
            "player": player.to_dict(include_role=False),
            "total_players": len(room.players),
        })

        # Message loop
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            await _dispatch(msg, player, room_code, websocket)

    except Exception as exc:
        print(f"WS error ({player_name}): {exc}")

    finally:
        manager.disconnect(websocket, room_code, player.id)
        if room_code in rooms:
            await _handle_disconnect(room, player, room_code)


# ─── Player Resolution ───────────────────────────────────────────────────────

def _resolve_player(room: Room, player_name: str) -> Player:
    """Find existing player by name (reconnect) or create a new one."""
    for p in room.players.values():
        if p.name == player_name:
            return p

    is_host = room.host_id == ""
    player = GameFactory.create_player(player_name, is_host=is_host)
    room.players[player.id] = player
    if is_host:
        room.host_id = player.id
    return player


async def _handle_disconnect(room: Room, player: Player, room_code: str) -> None:
    if room.game_phase == GamePhase.SETUP:
        room.players.pop(player.id, None)
        if room.players:
            await manager.broadcast(room_code, {
                "type": MessageType.PLAYER_LEFT.value,
                "player_id": player.id,
                "total_players": len(room.players),
            })


# ═══════════════════════════════════════════════════════════════════════════════
# Handler Registry (Strategy Pattern)
# ═══════════════════════════════════════════════════════════════════════════════

HandlerFn = Callable[
    [dict, Player, str, WebSocket, GameState],
    Awaitable[None],
]

_HANDLERS: Dict[str, HandlerFn] = {}


def _register(msg_type: MessageType):
    """Decorator that registers a handler for a message type."""
    def decorator(fn: HandlerFn):
        _HANDLERS[msg_type.value] = fn
        return fn
    return decorator


async def _dispatch(message: dict, player: Player, room_code: str, ws: WebSocket) -> None:
    if room_code not in rooms:
        return
    gs = rooms[room_code]
    msg_type = message.get("type", "")
    handler = _HANDLERS.get(msg_type)
    if handler:
        await handler(message, player, room_code, ws, gs)
    else:
        print(f"Unknown message type: {msg_type}")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _drawer_info(room: Room) -> dict:
    """Build a dict with current drawer details."""
    did = room.get_current_drawer_id()
    drawer = room.players.get(did) if did else None
    return {
        "drawer_id": did,
        "drawer_name": drawer.name if drawer else "Unknown",
        "round_progress": f"{room.current_drawer_index + 1}/{len(room.player_order)}",
    }


async def _send_words(room: Room, room_code: str) -> None:
    """Send each player their word privately."""
    for pid, p in room.players.items():
        word = GameService.get_word_for_player(room, p)
        await manager.send_to_player(room_code, pid, {
            "type": MessageType.YOUR_WORD.value,
            "word": word,
            "is_imposter": p.role == PlayerRole.IMPOSTER,
            "player_id": pid,
        })


# ═══════════════════════════════════════════════════════════════════════════════
# Handlers
# ═══════════════════════════════════════════════════════════════════════════════

@_register(MessageType.START_GAME)
async def _handle_start_game(msg, player, room_code, ws, gs):
    room = gs.room
    if player.id != room.host_id:
        await manager.send_to_ws(ws, {"type": MessageType.ERROR.value, "message": "Only host can start"})
        return
    try:
        GameService.start_game(room)
    except ValueError as e:
        await manager.send_to_ws(ws, {"type": MessageType.ERROR.value, "message": str(e)})
        return

    info = _drawer_info(room)
    await manager.broadcast(room_code, {
        "type": MessageType.GAME_STARTED.value,
        "round": room.current_round,
        "total_rounds": room.total_rounds,
        "phase": room.game_phase.value,
        "first_drawer_id": info["drawer_id"],
        "first_drawer_name": info["drawer_name"],
        "round_progress": info["round_progress"],
        "strokes": [],
    })
    await _send_words(room, room_code)


@_register(MessageType.DRAW_STROKE)
async def _handle_draw_stroke(msg, player, room_code, ws, gs):
    """Store a completed stroke and broadcast to all players in real time."""
    room = gs.room
    if player.id != room.get_current_drawer_id():
        return  # silently ignore

    stroke_data = msg.get("stroke", {})
    GameService.add_stroke(room, stroke_data, player.id)

    await manager.broadcast(room_code, {
        "type": MessageType.DRAWING_UPDATED.value,
        "strokes": room.get_strokes_serialized(),
        "drew_by": player.id,
        "player_name": player.name,
    })


@_register(MessageType.FINISH_DRAWING)
async def _handle_finish_drawing(msg, player, room_code, ws, gs):
    """Drawer signals they are done — advance to next drawer or chat phase."""
    room = gs.room
    if player.id != room.get_current_drawer_id():
        await manager.send_to_ws(ws, {"type": MessageType.ERROR.value, "message": "Not your turn"})
        return

    strokes = room.get_strokes_serialized()
    has_more = GameService.advance_drawer(room)

    if has_more:
        info = _drawer_info(room)
        await manager.broadcast(room_code, {
            "type": MessageType.NEXT_DRAWER.value,
            **info,
            "strokes": strokes,
        })
    else:
        await manager.broadcast(room_code, {
            "type": MessageType.ALL_DRAWINGS_SUBMITTED.value,
            "strokes": strokes,
            "chat_duration": room.chat_duration,
        })


@_register(MessageType.CHAT_MESSAGE)
async def _handle_chat_message(msg, player, room_code, ws, gs):
    text = msg.get("message", "")
    chat_msg = ChatMessage(
        player_id=player.id,
        player_name=player.name,
        message=text,
        timestamp=datetime.now(),
    )
    gs.chat_messages.append(chat_msg)
    await manager.broadcast(room_code, {
        "type": MessageType.CHAT_MESSAGE.value,
        **chat_msg.to_dict(),
    })


@_register(MessageType.END_CHAT)
async def _handle_end_chat(msg, player, room_code, ws, gs):
    room = gs.room
    more_rounds = GameService.advance_after_chat(room)

    if more_rounds:
        info = _drawer_info(room)
        await manager.broadcast(room_code, {
            "type": MessageType.NEW_ROUND.value,
            "round": room.current_round,
            "total_rounds": room.total_rounds,
            "phase": room.game_phase.value,
            "first_drawer_id": info["drawer_id"],
            "first_drawer_name": info["drawer_name"],
            "round_progress": info["round_progress"],
            "strokes": room.get_strokes_serialized(),
        })
    else:
        await manager.broadcast(room_code, {
            "type": MessageType.VOTING_STARTED.value,
            "round": room.current_round,
            "total_rounds": room.total_rounds,
        })


@_register(MessageType.SUBMIT_VOTE)
async def _handle_submit_vote(msg, player, room_code, ws, gs):
    room = gs.room
    voted_for = msg.get("vote_for", "")
    total = GameService.submit_vote(room, player.id, voted_for)

    if total >= len(room.players):
        result = GameService.tally_votes(room)
        await manager.broadcast(room_code, {
            "type": MessageType.VOTING_RESULTS.value,
            **result.to_dict(),
        })


@_register(MessageType.RESET_GAME)
async def _handle_reset_game(msg, player, room_code, ws, gs):
    room = gs.room
    if player.id != room.host_id:
        return
    GameService.reset_game(room)
    gs.chat_messages = []
    await manager.broadcast(room_code, {
        "type": MessageType.GAME_RESET.value,
        "message": "Game reset. Ready to start new game.",
    })
