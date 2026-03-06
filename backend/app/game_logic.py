"""
Game service — all game logic lives here.

Follows the Service pattern: stateless methods that operate on Room / GameState
aggregates. Uses Factory methods for object creation and a state-machine guard
for phase transitions.
"""

from __future__ import annotations

import random
from typing import Dict, List, Optional
from datetime import datetime

from .models import (
    Room, Player, GameState, GamePhase, PlayerRole,
    DrawingStroke, ChatMessage, VoteRecord, VotingResult,
)


# ─── Word Bank ────────────────────────────────────────────────────────────────

WORD_LIST: List[str] = [
    "cat", "dog", "tree", "house", "car", "sun", "moon", "star", "flower",
    "elephant", "giraffe", "penguin", "butterfly", "fish", "bird", "apple",
    "banana", "book", "chair", "table", "computer", "phone", "bottle", "cup",
    "clock", "heart", "smile", "crown", "diamond", "snowflake", "rocket",
    "castle", "bridge", "mountain", "river", "ocean", "island", "volcano",
    "anchor", "compass", "telescope", "microscope", "piano", "guitar",
]


# ─── Factory ──────────────────────────────────────────────────────────────────

class GameFactory:
    """Factory for creating game entities with sensible defaults."""

    @staticmethod
    def create_room() -> Room:
        return Room()

    @staticmethod
    def create_player(name: str, is_host: bool = False) -> Player:
        return Player(name=name, is_host=is_host)

    @staticmethod
    def create_game_state(room: Room) -> GameState:
        return GameState(room=room)

    @staticmethod
    def pick_words() -> tuple[str, str]:
        """Return (innocent_word, imposter_word) guaranteed to be different."""
        word = random.choice(WORD_LIST)
        dummy = random.choice([w for w in WORD_LIST if w != word])
        return word, dummy


# ─── State Machine Guard ─────────────────────────────────────────────────────

def _transition(room: Room, target: GamePhase) -> None:
    """Safely transition room to a new phase with guard check."""
    if not room.game_phase.can_transition_to(target):
        raise ValueError(
            f"Invalid phase transition: {room.game_phase.value} → {target.value}"
        )
    room.game_phase = target


# ─── Game Service ─────────────────────────────────────────────────────────────

class GameService:
    """
    Stateless service that encapsulates all game-logic mutations.
    Every public method takes the aggregate (Room / GameState) as first arg.
    """

    # ── Setup & Roles ─────────────────────────────────────────────────────

    @staticmethod
    def assign_roles(room: Room) -> None:
        players = list(room.players.values())
        random.shuffle(players)
        for p in players:
            p.role = PlayerRole.INNOCENT
        for i in range(min(room.imposter_count, len(players))):
            players[i].role = PlayerRole.IMPOSTER

    @staticmethod
    def get_word_for_player(room: Room, player: Player) -> str:
        return room.imposter_word if player.role == PlayerRole.IMPOSTER else room.current_word

    # ── Start Game ────────────────────────────────────────────────────────

    @staticmethod
    def start_game(room: Room) -> None:
        if len(room.players) < 2:
            raise ValueError("Need at least 2 players to start")

        GameService.assign_roles(room)

        room.player_order = list(room.players.keys())
        random.shuffle(room.player_order)

        room.current_round = 1
        room.current_word, room.imposter_word = GameFactory.pick_words()

        _transition(room, GamePhase.DRAWING)

        room.current_drawer_index = 0
        room.strokes = []
        room.votes = []
        room.round_start_time = datetime.now()

    # ── Drawing ───────────────────────────────────────────────────────────

    @staticmethod
    def add_stroke(room: Room, stroke_data: dict, player_id: str) -> DrawingStroke:
        """
        Append a stroke to the board. Returns the immutable DrawingStroke.
        """
        stroke = DrawingStroke.from_dict(
            stroke_data,
            player_id=player_id,
            round_number=room.current_round,
        )
        room.strokes.append(stroke)
        return stroke

    @staticmethod
    def advance_drawer(room: Room) -> bool:
        """
        Move to next drawer.
        Returns True if more players need to draw this round.
        Returns False if everyone has drawn → transitions to CHAT.
        """
        room.current_drawer_index += 1
        if room.current_drawer_index >= len(room.player_order):
            _transition(room, GamePhase.CHAT)
            room.current_drawer_index = 0
            return False
        return True

    # ── Round Management ──────────────────────────────────────────────────

    @staticmethod
    def advance_after_chat(room: Room) -> bool:
        """
        Called when chat phase ends.
        Returns True if there are more drawing rounds.
        Returns False if it's time for voting (last round finished).
        """
        if room.current_round < room.total_rounds:
            # More drawing rounds — word & strokes carry over
            room.current_round += 1
            _transition(room, GamePhase.DRAWING)
            room.current_drawer_index = 0
            room.round_start_time = datetime.now()
            return True
        else:
            _transition(room, GamePhase.VOTING)
            return False

    # ── Voting ────────────────────────────────────────────────────────────

    @staticmethod
    def submit_vote(room: Room, voter_id: str, voted_for_id: str) -> int:
        """
        Record a vote. Returns total votes cast so far.
        Prevents double-voting.
        """
        # Prevent double vote
        if any(v.voter_id == voter_id for v in room.votes):
            return len(room.votes)

        room.votes.append(VoteRecord(voter_id=voter_id, voted_for_id=voted_for_id))
        return len(room.votes)

    @staticmethod
    def tally_votes(room: Room) -> VotingResult:
        """Count votes, determine winner, and transition to RESULTS."""
        imposter_ids = [p.id for p in room.get_imposters()]
        imposter_set = set(imposter_ids)

        vote_counts: Dict[str, int] = {}
        for v in room.votes:
            vote_counts[v.voted_for_id] = vote_counts.get(v.voted_for_id, 0) + 1

        if not vote_counts:
            result = VotingResult(
                winner="imposter",
                imposter_voted_out=False,
                imposter_ids=imposter_ids,
                most_voted_id=None,
                vote_counts={},
            )
        else:
            max_votes = max(vote_counts.values())
            top_voted = [pid for pid, cnt in vote_counts.items() if cnt == max_votes]

            if len(top_voted) > 1:
                # Tie — no one is eliminated, imposter wins
                result = VotingResult(
                    winner="imposter",
                    imposter_voted_out=False,
                    imposter_ids=imposter_ids,
                    most_voted_id=None,
                    vote_counts=vote_counts,
                )
            else:
                most_voted = top_voted[0]
                voted_out = most_voted in imposter_set
                result = VotingResult(
                    winner="innocent" if voted_out else "imposter",
                    imposter_voted_out=voted_out,
                    imposter_ids=imposter_ids,
                    most_voted_id=most_voted,
                    vote_counts=vote_counts,
                )

        _transition(room, GamePhase.RESULTS)
        return result

    # ── Reset ─────────────────────────────────────────────────────────────

    @staticmethod
    def reset_game(room: Room) -> None:
        """Full reset back to lobby."""
        _transition(room, GamePhase.SETUP)
        room.current_round = 0
        room.current_word = ""
        room.imposter_word = ""
        room.current_drawer_index = 0
        room.strokes = []
        room.votes = []
        room.round_start_time = None
        room.player_order = []
        for p in room.players.values():
            p.role = PlayerRole.INNOCENT

