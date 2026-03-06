"""
Domain models for Vision of Imposter.

Uses value objects and proper encapsulation following DDD principles.
Coordinates are normalized to [0,1] for resolution-independent drawing.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Dict, Optional
from enum import Enum
import uuid
from datetime import datetime


# ─── Enums ────────────────────────────────────────────────────────────────────

class GamePhase(Enum):
    """Finite state machine phases for the game lifecycle."""
    SETUP = "setup"
    DRAWING = "drawing"
    CHAT = "chat"
    VOTING = "voting"
    RESULTS = "results"

    def can_transition_to(self, target: "GamePhase") -> bool:
        return target in _PHASE_TRANSITIONS.get(self, set())


_PHASE_TRANSITIONS: Dict[GamePhase, set] = {
    GamePhase.SETUP:   {GamePhase.DRAWING},
    GamePhase.DRAWING: {GamePhase.CHAT},
    GamePhase.CHAT:    {GamePhase.DRAWING, GamePhase.VOTING},
    GamePhase.VOTING:  {GamePhase.RESULTS},
    GamePhase.RESULTS: {GamePhase.SETUP},
}


class PlayerRole(Enum):
    INNOCENT = "innocent"
    IMPOSTER = "imposter"


class MessageType(Enum):
    """All WebSocket message types — prevents typo bugs."""
    # Client → Server
    START_GAME = "start_game"
    SUBMIT_DRAWING = "submit_drawing"
    DRAW_STROKE = "draw_stroke"
    FINISH_DRAWING = "finish_drawing"
    CHAT_MESSAGE = "chat_message"
    END_CHAT = "end_chat"
    SUBMIT_VOTE = "submit_vote"
    RESET_GAME = "reset_game"

    # Server → Client
    ROOM_STATE = "room_state"
    PLAYER_JOINED = "player_joined"
    PLAYER_LEFT = "player_left"
    GAME_STARTED = "game_started"
    YOUR_WORD = "your_word"
    NEXT_DRAWER = "next_drawer"
    DRAWING_UPDATED = "drawing_updated"
    ALL_DRAWINGS_SUBMITTED = "all_drawings_submitted"
    NEW_ROUND = "new_round"
    VOTING_STARTED = "voting_started"
    VOTING_RESULTS = "voting_results"
    GAME_RESET = "game_reset"
    ERROR = "error"


# ─── Value Objects (immutable) ────────────────────────────────────────────────

@dataclass(frozen=True)
class DrawingStroke:
    """
    A single stroke on the shared canvas.
    Points are in **normalized [0,1]** coordinates for resolution independence.
    """
    points: tuple                   # tuple of (x, y) pairs, all in 0-1 range
    color: str = "#000"
    width: float = 3.0
    player_id: str = ""
    round_number: int = 0

    def to_dict(self) -> dict:
        return {
            "points": list(self.points),
            "color": self.color,
            "width": self.width,
            "player_id": self.player_id,
            "round_number": self.round_number,
        }

    @classmethod
    def from_dict(cls, data: dict, player_id: str = "", round_number: int = 0) -> "DrawingStroke":
        raw_points = data.get("points", [])
        return cls(
            points=tuple(tuple(p) for p in raw_points),
            color=data.get("color", "#000"),
            width=data.get("width", 3.0),
            player_id=player_id,
            round_number=round_number,
        )


@dataclass(frozen=True)
class ChatMessage:
    player_id: str
    player_name: str
    message: str
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict:
        return {
            "player_id": self.player_id,
            "player_name": self.player_name,
            "message": self.message,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass(frozen=True)
class VoteRecord:
    voter_id: str
    voted_for_id: str


@dataclass(frozen=True)
class VotingResult:
    winner: str                     # "innocent" | "imposter"
    imposter_voted_out: bool
    imposter_ids: List[str]
    most_voted_id: Optional[str]
    vote_counts: Dict[str, int]

    def to_dict(self) -> dict:
        return {
            "winner": self.winner,
            "imposter_voted_out": self.imposter_voted_out,
            "imposter_ids": self.imposter_ids,
            "most_voted_id": self.most_voted_id,
            "vote_counts": self.vote_counts,
        }


# ─── Entities ─────────────────────────────────────────────────────────────────

@dataclass
class Player:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    role: PlayerRole = PlayerRole.INNOCENT
    is_host: bool = False

    def to_dict(self, include_role: bool = True) -> dict:
        data = {"id": self.id, "name": self.name, "is_host": self.is_host}
        if include_role:
            data["role"] = self.role.value
        return data


@dataclass
class Room:
    """Aggregate root for a game room."""
    code: str = field(default_factory=lambda: ''.join([str(uuid.uuid4().int)[:6]]))
    host_id: str = ""
    players: Dict[str, Player] = field(default_factory=dict)
    player_order: List[str] = field(default_factory=list)

    # Word state (constant for the whole game)
    current_word: str = ""
    imposter_word: str = ""

    # Round state
    current_round: int = 0
    total_rounds: int = 3
    game_phase: GamePhase = GamePhase.SETUP

    # Drawing state — list of immutable strokes that ACCUMULATE across rounds
    strokes: List[DrawingStroke] = field(default_factory=list)
    current_drawer_index: int = 0
    drawing_time_limit: int = 20

    # Config
    chat_duration: int = 120
    imposter_count: int = 1

    # Voting
    votes: List[VoteRecord] = field(default_factory=list)

    # Timestamps
    round_start_time: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)

    # ── Queries ───────────────────────────────────────────────────────────

    def get_current_drawer_id(self) -> Optional[str]:
        if self.player_order and 0 <= self.current_drawer_index < len(self.player_order):
            return self.player_order[self.current_drawer_index]
        return None

    def get_current_drawer(self) -> Optional[Player]:
        did = self.get_current_drawer_id()
        return self.players.get(did) if did else None

    def get_innocents(self) -> List[Player]:
        return [p for p in self.players.values() if p.role == PlayerRole.INNOCENT]

    def get_imposters(self) -> List[Player]:
        return [p for p in self.players.values() if p.role == PlayerRole.IMPOSTER]

    def get_strokes_serialized(self) -> List[dict]:
        """Return all strokes as a JSON-ready list."""
        return [s.to_dict() for s in self.strokes]

    def to_dict(self) -> dict:
        return {
            "code": self.code,
            "host_id": self.host_id,
            "player_count": len(self.players),
            "current_round": self.current_round,
            "total_rounds": self.total_rounds,
            "chat_duration": self.chat_duration,
            "imposter_count": self.imposter_count,
            "game_phase": self.game_phase.value,
            "current_drawer_id": self.get_current_drawer_id(),
        }


@dataclass
class GameState:
    """Top-level container for room + transient per-game data."""
    room: Room
    chat_messages: List[ChatMessage] = field(default_factory=list)

