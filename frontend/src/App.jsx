/**
 * App.jsx — root component with useReducer-based state management.
 *
 * Game state is managed via a reducer (command pattern) instead of
 * scattered setState calls.  Each server message maps to a reducer action.
 */
import React, { useReducer, useCallback } from 'react';
import RoomSetup from './components/RoomSetup';
import GameBoard from './components/GameBoard';
import useSocket from './hooks/useSocket';
import './index.css';

// ─── Initial State ───────────────────────────────────────────────────────────

const INITIAL_STATE = {
  mode: 'setup',            // 'setup' | 'lobby' | 'game'
  roomCode: null,
  playerName: null,
  playerId: null,
  playerRole: null,
  players: [],
  gamePhase: 'setup',
  wordToDisplay: '',
  currentRound: 0,
  totalRounds: 3,
  chatDuration: 120,
  isHost: false,
  strokes: [],              // Array of stroke objects (normalized coords)
  currentDrawerId: null,
  currentDrawerName: 'Unknown',
  roundProgress: '0/0',
  isYourTurn: false,
  chatMessages: [],
  votingResults: null,
};

// ─── Reducer ─────────────────────────────────────────────────────────────────

function gameReducer(state, action) {
  switch (action.type) {
    // ── Local UI actions ──────────────────────────────────────────────
    case 'JOIN_LOBBY':
      return { ...state, ...action.payload, mode: 'lobby' };

    // ── Server message actions ────────────────────────────────────────
    case 'connection_failed':
      return { ...INITIAL_STATE };

    case 'room_state':
      return {
        ...state,
        players: action.players,
        playerId: action.your_player_id,
        isHost: action.is_host,
        gamePhase: action.game_phase,
      };

    case 'player_joined': {
      const exists = state.players.some((p) => p.id === action.player.id);
      if (exists) return state;
      return { ...state, players: [...state.players, action.player] };
    }

    case 'player_left':
      return {
        ...state,
        players: state.players.filter((p) => p.id !== action.player_id),
      };

    case 'game_started':
      return {
        ...state,
        mode: 'game',
        gamePhase: action.phase,
        currentRound: action.round,
        totalRounds: action.total_rounds ?? state.totalRounds,
        currentDrawerId: action.first_drawer_id,
        currentDrawerName: action.first_drawer_name,
        isYourTurn: state.playerId === action.first_drawer_id,
        roundProgress: action.round_progress,
        strokes: action.strokes ?? [],
      };

    case 'your_word':
      return {
        ...state,
        wordToDisplay: action.word,
        playerRole: action.is_imposter ? 'imposter' : 'innocent',
        playerId: action.player_id,
        isYourTurn: action.player_id === state.currentDrawerId,
      };

    case 'next_drawer': {
      const drawer = state.players.find((p) => p.id === action.drawer_id);
      return {
        ...state,
        strokes: action.strokes ?? state.strokes,
        currentDrawerId: action.drawer_id,
        currentDrawerName: action.drawer_name ?? drawer?.name ?? 'Unknown',
        isYourTurn: state.playerId === action.drawer_id,
        roundProgress: action.round_progress,
      };
    }

    case 'drawing_updated':
      return { ...state, strokes: action.strokes ?? state.strokes };

    case 'all_drawings_submitted':
      return {
        ...state,
        gamePhase: 'chat',
        strokes: action.strokes ?? state.strokes,
        chatDuration: action.chat_duration,
        chatMessages: [],
      };

    case 'new_round':
      return {
        ...state,
        gamePhase: action.phase,
        currentRound: action.round,
        totalRounds: action.total_rounds ?? state.totalRounds,
        strokes: action.strokes ?? state.strokes,      // carry over!
        currentDrawerId: action.first_drawer_id,
        currentDrawerName: action.first_drawer_name ?? 'Unknown',
        isYourTurn: state.playerId === action.first_drawer_id,
        roundProgress: action.round_progress ?? '0/0',
        chatMessages: [],
      };

    case 'voting_started':
      return {
        ...state,
        gamePhase: 'voting',
        currentRound: action.round,
        totalRounds: action.total_rounds,
      };

    case 'voting_results':
      return {
        ...state,
        gamePhase: 'results',
        votingResults: {
          winner: action.winner,
          imposterVotedOut: action.imposter_voted_out,
          imposterIds: action.imposter_ids,
          mostVotedId: action.most_voted_id,
          voteCounts: action.vote_counts,
        },
      };

    case 'chat_message':
      return {
        ...state,
        chatMessages: [
          ...state.chatMessages,
          {
            player_id: action.player_id,
            player_name: action.player_name,
            message: action.message,
            timestamp: new Date(action.timestamp).toLocaleTimeString(),
          },
        ],
      };

    case 'game_reset':
      return {
        ...state,
        mode: 'lobby',
        gamePhase: 'setup',
        currentRound: 0,
        wordToDisplay: '',
        playerRole: null,
        strokes: [],
        votingResults: null,
        chatMessages: [],
      };

    case 'error':
      console.error('Server error:', action.message);
      return state;

    default:
      console.warn('Unknown action:', action.type);
      return state;
  }
}

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  const [state, dispatch] = useReducer(gameReducer, INITIAL_STATE);

  // Dispatch server messages directly (they already have `type`)
  const handleMessage = useCallback((msg) => dispatch(msg), []);

  const { send, connected } = useSocket(state.roomCode, state.playerName, handleMessage);

  // ── Room creation ────────────────────────────────────────────────────
  const handleCreateRoom = useCallback(async (config) => {
    try {
      const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API}/room/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host_name: config.playerName }),
      });
      const data = await res.json();
      if (!data.success) return;

      await fetch(`${API}/room/${data.room_code}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imposter_count: config.imposterCount,
          total_rounds: config.totalRounds,
          chat_duration: config.chatDuration,
        }),
      });

      dispatch({
        type: 'JOIN_LOBBY',
        payload: {
          roomCode: data.room_code,
          playerName: config.playerName,
          totalRounds: config.totalRounds,
          chatDuration: config.chatDuration,
          isHost: true,
        },
      });
    } catch (err) {
      console.error('Create room failed:', err);
    }
  }, []);

  const handleJoinRoom = useCallback((config) => {
    dispatch({
      type: 'JOIN_LOBBY',
      payload: {
        roomCode: config.roomCode,
        playerName: config.playerName,
        isHost: false,
      },
    });
  }, []);

  const handleAction = useCallback((action) => send(action), [send]);

  // ── Render ───────────────────────────────────────────────────────────
  if (state.mode === 'setup') {
    return <RoomSetup onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />;
  }

  return (
    <GameBoard
      roomCode={state.roomCode}
      playerName={state.playerName}
      playerRole={state.playerRole}
      wordToDisplay={state.wordToDisplay}
      gamePhase={state.gamePhase}
      onAction={handleAction}
      players={state.players}
      currentRound={state.currentRound}
      totalRounds={state.totalRounds}
      chatDuration={state.chatDuration}
      isHost={state.isHost}
      strokes={state.strokes}
      isYourTurn={state.isYourTurn}
      currentDrawerName={state.currentDrawerName}
      roundProgress={state.roundProgress}
      chatMessages={state.chatMessages}
      votingResults={state.votingResults}
      playerId={state.playerId}
    />
  );
}

export default App;
