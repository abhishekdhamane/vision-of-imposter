import React, { useState, useCallback, useEffect } from 'react';
import RoomSetup from './components/RoomSetup';
import GameBoard from './components/GameBoard';
import useSocket from './hooks/useSocket';
import './index.css';

function App() {
  const [gameState, setGameState] = useState({
    mode: 'setup', // 'setup' | 'lobby' | 'game'
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
    // Shared drawing board
    sharedDrawingData: '[]',
    currentDrawerId: null,
    currentDrawerName: 'Unknown',
    roundProgress: '0/0',
    isYourTurn: false,
    chatMessages: [],
  });

  const { send, connected } = useSocket(gameState.roomCode, gameState.playerName, handleMessage);

  function handleMessage(message) {
    console.log('Message received:', message);
    const { type } = message;;

    switch (type) {
      case 'connection_failed':
        alert(message.reason || 'Connection lost. Please create or join a room again.');
        setGameState((prev) => ({
          ...prev,
          mode: 'setup',
          roomCode: null,
          playerName: null,
          players: [],
        }));
        break;

      case 'room_state':
        setGameState((prev) => ({
          ...prev,
          players: message.players,
          playerId: message.your_player_id,
          isHost: message.is_host,
          gamePhase: message.game_phase,
        }));
        break;

      case 'player_joined':
        setGameState((prev) => {
          // Check if player already exists to avoid duplicates
          const playerExists = prev.players.some((p) => p.id === message.player.id);
          if (playerExists) {
            return prev;
          }
          return {
            ...prev,
            players: [...prev.players, message.player],
          };
        });
        break;

      case 'player_left':
        setGameState((prev) => ({
          ...prev,
          players: prev.players.filter((p) => p.id !== message.player_id),
        }));
        break;

      case 'game_started':
        setGameState((prev) => ({
          ...prev,
          mode: 'game',
          gamePhase: message.phase,
          currentRound: message.round,
          currentDrawerId: message.first_drawer_id,
          currentDrawerName: message.first_drawer_name,
          isYourTurn: prev.playerId === message.first_drawer_id,
          roundProgress: message.round_progress,
          sharedDrawingData: '[]',
        }));
        break;

      case 'your_word':
        setGameState((prev) => ({
          ...prev,
          wordToDisplay: message.word,
          playerRole: message.is_imposter ? 'imposter' : 'innocent',
          playerId: message.player_id,
          isYourTurn: message.player_id === prev.currentDrawerId,
        }));
        break;

      case 'next_drawer':
        setGameState((prev) => {
          const drawerPlayer = prev.players.find((p) => p.id === message.drawer_id);
          return {
            ...prev,
            sharedDrawingData: message.drawing_data,
            currentDrawerId: message.drawer_id,
            currentDrawerName: drawerPlayer?.name || 'Unknown',
            isYourTurn: prev.playerId === message.drawer_id,
            roundProgress: message.round_progress,
          };
        });
        break;

      case 'drawing_updated':
        const drawUpdatedPlayerName = gameState.players.find((p) => p.id === message.drew_by)?.name;
        setGameState((prev) => ({
          ...prev,
          sharedDrawingData: message.drawing_data,
        }));
        break;

      case 'all_drawings_submitted':
        setGameState((prev) => ({
          ...prev,
          gamePhase: 'chat',
          chatDuration: message.chat_duration,
          chatMessages: [],  // Reset chat for new phase
        }));
        break;

      case 'voting_started':
        setGameState((prev) => ({
          ...prev,
          gamePhase: 'voting',
          currentRound: message.round,
          totalRounds: message.total_rounds,
        }));
        break;

      case 'voting_results':
        setGameState((prev) => ({
          ...prev,
          gamePhase: 'results',
        }));
        break;

      case 'new_round':
        setGameState((prev) => ({
          ...prev,
          gamePhase: message.phase,
          currentRound: message.round,
          wordToDisplay: '',
        }));
        break;

      case 'game_reset':
        setGameState((prev) => ({
          ...prev,
          gamePhase: 'setup',
          currentRound: 0,
          wordToDisplay: '',
          playerRole: null,
        }));
        break;

      case 'error':
        console.error('Server error:', message.message);
        break;

      case 'chat_message':
        setGameState((prev) => ({
          ...prev,
          chatMessages: [...prev.chatMessages, {
            player_id: message.player_id,
            player_name: message.player_name,
            message: message.message,
            timestamp: new Date(message.timestamp).toLocaleTimeString(),
          }],
        }));
        break;

      default:
        console.warn('Unknown message type:', type);
    }
  }

  const handleCreateRoom = useCallback(async (config) => {
    try {
      const response = await fetch('http://localhost:8000/room/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host_name: config.playerName }),
      });
      const data = await response.json();

      if (data.success) {
        // Configure room
        await fetch(`http://localhost:8000/room/${data.room_code}/config`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imposter_count: config.imposterCount,
            total_rounds: config.totalRounds,
            chat_duration: config.chatDuration,
          }),
        });

        setGameState((prev) => ({
          ...prev,
          mode: 'lobby',
          roomCode: data.room_code,
          playerName: config.playerName,
          totalRounds: config.totalRounds,
          chatDuration: config.chatDuration,
          isHost: true,
        }));
      }
    } catch (error) {
      console.error('Error creating room:', error);
    }
  }, []);

  const handleJoinRoom = useCallback((config) => {
    setGameState((prev) => ({
      ...prev,
      mode: 'lobby',
      roomCode: config.roomCode,
      playerName: config.playerName,
      isHost: false,
    }));
  }, []);

  const handleGameAction = useCallback((action) => {
    send(action);
  }, [send]);

  if (gameState.mode === 'setup') {
    return (
      <RoomSetup onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
    );
  }

  if (gameState.mode === 'lobby' || gameState.mode === 'game') {
    return (
      <GameBoard
        roomCode={gameState.roomCode}
        playerName={gameState.playerName}
        playerRole={gameState.playerRole}
        wordToDisplay={gameState.wordToDisplay}
        gamePhase={gameState.gamePhase}
        onAction={handleGameAction}
        players={gameState.players}
        currentRound={gameState.currentRound}
        totalRounds={gameState.totalRounds}
        chatDuration={gameState.chatDuration}
        isHost={gameState.isHost}
        sharedDrawingData={gameState.sharedDrawingData}
        isYourTurn={gameState.isYourTurn}
        currentDrawerName={gameState.currentDrawerName}
        roundProgress={gameState.roundProgress}
        chatMessages={gameState.chatMessages}
      />
    );
  }

  return <div>Loading...</div>;
}

export default App;
