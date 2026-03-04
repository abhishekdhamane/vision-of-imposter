# Vision of Imposter 🎨

A multiplayer online drawing deduction game where players try to identify who the imposter is based on their drawings.

## Game Rules

1. **Setup**: Players join a room with a code. Host configures game settings.
2. **Shared Drawing Board**: All players draw on the same board, taking turns
3. **One Line Rule**: Each player draws exactly ONE LINE on the shared board, then next player's turn
4. **Imposter Twist**: 
   - Innocents know the word and draw to represent it
   - Imposters don't know the word (get dummy word) but can see what others draw
5. **Chat Phase**: After all players draw a line, discuss and accuse for 2 min (default)
6. **Voting**: After N rounds, players vote on who's the imposter
7. **Winning**: 
   - Innocents win if they vote out the imposter
   - Imposters win if they survive all rounds

## Features

✨ **Real-time WebSocket Communication**
- Smooth, responsive gameplay
- Live player updates
- Instant message broadcasting

🎨 **Canvas Drawing**
- One-line drawing mechanic
- Real-time canvas synchronization
- Clear & submit buttons

💬 **Chat System**
- Discussion after each round
- Configurable duration (default 2 minutes)
- Player names visible

🗳️ **Voting System**
- Vote reveal after submission
- Vote counting
- Results display

⚙️ **Customizable Settings**
- Number of imposters (1-5)
- Rounds before voting (1-10)
- Chat duration (30-300 seconds)

## Tech Stack

**Backend:**
- Python FastAPI
- WebSocket support
- Async event handling

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- HTML5 Canvas

## Installation

### Prerequisites
- Python 3.9+
- uv (fast Python package manager)
- Node.js 16+ & npm

### Backend Setup

```bash
cd backend

# Run with uv (installs dependencies automatically)
uv run python run.py
```

Or with traditional pip:
```bash
python -m venv venv
source venv/Scripts/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

Server runs on `http://localhost:8000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

Frontend runs on `http://localhost:5173`

## Usage

1. Open http://localhost:5173 in your browser
2. **Create Room**: Enter your name, configure settings, create room
3. **Share Code**: Give the room code to friends
4. **Join Room**: Friends enter the code to join
5. **Start Game**: Host clicks "Start Game" when ready
6. **Play**: Draw, chat, vote, repeat!

## Project Structure

```
vision-of-imposter/
├── backend/
│   ├── app/
│   │   ├── models.py          # Data models
│   │   ├── game_logic.py      # Game rules
│   │   ├── websocket_manager.py # Connection handling
│   │   └── main.py            # FastAPI app
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom hooks
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
└── README.md
```

## Game Flow

```
1. Room Setup
   ↓
2. Players Join (Lobby)
   ↓
3. Host Starts Game
   ↓
4. Drawing Phase (all players draw)
   ↓
5. Chat Phase (discuss/accuse)
   ↓
6. Voting Phase (vote for imposter)
   ↓
7. Results (repeat or end)
```

## API Endpoints

### REST

- `POST /room/create` - Create new room
- `GET /room/{code}` - Get room info
- `POST /room/{code}/config` - Configure room settings

### WebSocket

- `/ws/{room_code}/{player_name}` - Main game connection

### Events

**Incoming:**
- `start_game` - Start the game
- `submit_drawing` - Submit drawing data
- `chat_message` - Send chat message
- `end_chat` - End chat phase
- `submit_vote` - Vote for player
- `next_round` - Move to next round
- `reset_game` - Reset game

**Outgoing:**
- `player_joined` - New player joined
- `game_started` - Game started
- `your_word` - Your drawing word
- `all_drawings_submitted` - All players ready for chat
- `voting_started` - Voting phase active
- `voting_results` - Results of vote
- `new_round` - New round started
- `game_reset` - Game reset

## Future Enhancements

- [ ] Player profiles & stats
- [ ] Spectator mode
- [ ] Leaderboard
- [ ] More word categories
- [ ] Sound effects
- [ ] Mobile app
- [ ] Database for persistence
- [ ] Room password protection
- [ ] Drawing replay
- [ ] AI opponents

## Contributing

Feel free to submit issues and pull requests!

## License

MIT
