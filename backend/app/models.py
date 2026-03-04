from dataclasses import dataclass, field
from typing import List, Dict, Optional
from enum import Enum
import uuid
from datetime import datetime

class GamePhase(Enum):
    SETUP = "setup"
    WAITING = "waiting"
    DRAWING = "drawing"
    CHAT = "chat"
    VOTING = "voting"
    RESULTS = "results"

class PlayerRole(Enum):
    INNOCENT = "innocent"
    IMPOSTER = "imposter"

@dataclass
class Player:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    role: PlayerRole = PlayerRole.INNOCENT
    is_host: bool = False
    
    def to_dict(self, include_role=True):
        data = {
            "id": self.id,
            "name": self.name,
            "is_host": self.is_host,
        }
        if include_role:
            data["role"] = self.role.value
        return data

@dataclass
class Room:
    code: str = field(default_factory=lambda: ''.join([str(uuid.uuid4().int)[:6]]))
    host_id: str = ""
    players: Dict[str, Player] = field(default_factory=dict)
    player_order: List[str] = field(default_factory=list)  # Ordered list of player IDs
    current_word: str = ""
    current_round: int = 0
    total_rounds_before_voting: int = 3
    chat_duration: int = 120  # seconds
    imposter_count: int = 1
    game_phase: GamePhase = GamePhase.SETUP
    round_start_time: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.now)
    
    # Shared drawing board
    shared_drawing_data: str = ""  # Serialized canvas strokes (list of lines)
    current_drawer_index: int = 0  # Index in player_order
    drawing_time_limit: int = 20  # seconds per player to draw
    
    def get_current_drawer_id(self) -> Optional[str]:
        """Get the player who is currently drawing."""
        if self.player_order and self.current_drawer_index < len(self.player_order):
            return self.player_order[self.current_drawer_index]
        return None
    
    def get_innocents(self):
        return [p for p in self.players.values() if p.role == PlayerRole.INNOCENT]
    
    def get_imposters(self):
        return [p for p in self.players.values() if p.role == PlayerRole.IMPOSTER]
    
    def to_dict(self):
        return {
            "code": self.code,
            "host_id": self.host_id,
            "player_count": len(self.players),
            "current_round": self.current_round,
            "total_rounds_before_voting": self.total_rounds_before_voting,
            "chat_duration": self.chat_duration,
            "imposter_count": self.imposter_count,
            "game_phase": self.game_phase.value,
            "current_drawer_id": self.get_current_drawer_id(),
        }

@dataclass
class ChatMessage:
    player_id: str
    player_name: str
    message: str
    timestamp: datetime = field(default_factory=datetime.now)
    
    def to_dict(self):
        return {
            "player_id": self.player_id,
            "player_name": self.player_name,
            "message": self.message,
            "timestamp": self.timestamp.isoformat(),
        }

@dataclass
class GameState:
    room: Room
    chat_messages: List[ChatMessage] = field(default_factory=list)
    votes_submitted: int = 0  # Track how many voted

