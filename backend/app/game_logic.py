import random
import json
from typing import List, Dict, Optional
from .models import Room, Player, GamePhase, PlayerRole
from datetime import datetime

# Word list for the game
WORD_LIST = [
    "cat", "dog", "tree", "house", "car", "sun", "moon", "star", "flower",
    "elephant", "giraffe", "penguin", "butterfly", "fish", "bird", "apple",
    "banana", "book", "chair", "table", "computer", "phone", "bottle", "cup",
    "clock", "heart", "smile", "crown", "diamond", "snowflake", "rocket",
    "castle", "bridge", "mountain", "river", "ocean", "island", "volcano",
    "anchor", "compass", "telescope", "microscope", "piano", "guitar"
]

class GameLogic:
    
    @staticmethod
    def assign_imposters(room: Room) -> None:
        """Randomly assign imposter roles to players."""
        players_list = list(room.players.values())
        random.shuffle(players_list)
        
        # Reset all to innocent first
        for player in players_list:
            player.role = PlayerRole.INNOCENT
        
        # Assign imposters
        for i in range(min(room.imposter_count, len(players_list))):
            players_list[i].role = PlayerRole.IMPOSTER
    
    @staticmethod
    def get_word_for_player(room: Room, player: Player) -> str:
        """
        Get word to display to player.
        - Innocents get the actual word
        - Imposters get a dummy word
        """
        if player.role == PlayerRole.IMPOSTER:
            # Return a random word different from actual word
            dummy_words = [w for w in WORD_LIST if w != room.current_word]
            return random.choice(dummy_words)
        return room.current_word
    
    @staticmethod
    def start_game(room: Room) -> None:
        """Initialize game state and assign roles."""
        if len(room.players) < 2:
            raise ValueError("Need at least 2 players to start")
        
        GameLogic.assign_imposters(room)
        
        # Create player order for drawing
        room.player_order = list(room.players.keys())
        random.shuffle(room.player_order)
        
        room.current_round = 1
        room.current_word = random.choice(WORD_LIST)
        room.game_phase = GamePhase.DRAWING
        room.current_drawer_index = 0
        room.shared_drawing_data = json.dumps([])  # Start with empty drawing
        room.round_start_time = datetime.now()
    
    @staticmethod
    def next_drawer(room: Room) -> bool:
        """
        Move to next drawer.
        Returns True if there are more players to draw.
        Returns False if all players have drawn (move to chat phase).
        """
        room.current_drawer_index += 1
        
        if room.current_drawer_index >= len(room.player_order):
            # All players have drawn
            room.game_phase = GamePhase.CHAT
            room.current_drawer_index = 0  # Reset for next round
            return False
        
        return True
    
    @staticmethod
    def next_round(room: Room) -> None:
        """Move to next round or voting phase."""
        room.current_round += 1
        
        if room.current_round > room.total_rounds_before_voting:
            room.game_phase = GamePhase.VOTING
        else:
            room.current_word = random.choice(WORD_LIST)
            room.game_phase = GamePhase.DRAWING
            room.current_drawer_index = 0
            room.shared_drawing_data = json.dumps([])  # Reset drawing
            room.round_start_time = datetime.now()
    
    @staticmethod
    def add_line_to_shared_board(room: Room, line_data: dict) -> str:
        """
        Add a drawn line to the shared board.
        Returns the updated drawing data.
        """
        try:
            drawing = json.loads(room.shared_drawing_data)
        except:
            drawing = []
        
        drawing.append(line_data)
        updated_data = json.dumps(drawing)
        room.shared_drawing_data = updated_data
        
        return updated_data
    
    @staticmethod
    def tally_votes(room: Room) -> Dict:
        """
        Count votes and determine winner.
        Returns: {"imposter_voted_out": bool, "imposter_ids": [], "vote_counts": {}, "winner": str}
        """
        vote_counts = {}
        imposters = room.get_imposters()
        imposter_ids = {p.id for p in imposters}
        
        for player in room.players.values():
            if hasattr(player, 'vote_for') and player.vote_for:
                vote_counts[player.vote_for] = vote_counts.get(player.vote_for, 0) + 1
        
        # Find who got most votes
        if not vote_counts:
            return {
                "imposter_voted_out": False,
                "imposter_ids": list(imposter_ids),
                "vote_counts": {},
                "winner": "imposter"
            }
        
        most_voted = max(vote_counts, key=vote_counts.get)
        imposter_voted_out = most_voted in imposter_ids
        
        return {
            "imposter_voted_out": imposter_voted_out,
            "imposter_ids": list(imposter_ids),
            "most_voted_id": most_voted,
            "vote_counts": vote_counts,
            "winner": "innocent" if imposter_voted_out else "imposter"
        }
    
    @staticmethod
    def reset_game(room: Room) -> None:
        """Reset game for new round."""
        room.current_round = 0
        room.current_word = ""
        room.game_phase = GamePhase.SETUP
        room.current_drawer_index = 0
        room.shared_drawing_data = json.dumps([])
        room.round_start_time = None
        room.player_order = []
        
        for player in room.players.values():
            player.role = PlayerRole.INNOCENT
            if hasattr(player, 'vote_for'):
                player.vote_for = None

