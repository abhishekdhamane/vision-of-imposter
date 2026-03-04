## Vision of Imposter - Quick Start Guide

### Prerequisites
- **Python 3.9+** - [Download](https://www.python.org/downloads/)
- **uv** - Fast Python package manager - [Install](https://astral.sh/blog/uv)
- **Node.js 16+** - [Download](https://nodejs.org/)

### Setup & Run (Windows)

#### Option 1: Automatic (Recommended)
1. Double-click `start-game.bat` in the project root
2. Wait for both windows to open
3. Open http://localhost:5173 in your browser

#### Option 2: Manual Setup with uv

**Terminal 1 - Backend:**
```bash
cd backend

# Run with uv (installs dependencies automatically)
uv run python run.py
```
Backend runs on http://localhost:8000

**Terminal 2 - Frontend:**
```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```
Frontend runs on http://localhost:5173

#### Option 3: Traditional Setup with pip

If you prefer, you can still use traditional venv:
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

### How to Play

1. **Create a Room**
   - Click "Create Room"
   - Enter your player name
   - Configure game settings (optional)
   - Click "Create & Start"

2. **Share Room Code**
   - Give the 6-digit code to your friends

3. **Players Join**
   - Friends click "Join Room"
   - Enter their name and code

4. **Start Game**
   - When all ready, host clicks "Start Game"

5. **Play!**
   - **Drawing Phase**: All draw ONE line for the word shown
     - Innocents see the real word
     - Imposter sees a fake word
   - **Chat Phase**: Discuss and accuse (2 min default)
   - **Voting Phase**: Vote for who you think is imposter
   - Repeat for configured rounds

6. **Results**
   - See who was the imposter
   - Start new game to play again

### Game Settings

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| Imposters | 1 | 1-5 | Number of imposters |
| Rounds | 3 | 1-10 | Drawing rounds before voting |
| Chat Duration | 120s | 30-300s | Time to discuss |

### Troubleshooting

**"Port already in use"**
- Another app is using port 8000 or 5173
- Solution: Change ports in server config or close other apps

**"ModuleNotFoundError"**
- Python dependencies not installed
- Solution: Run `pip install -r requirements.txt`

**"Cannot find module"**
- Node dependencies not installed
- Solution: Run `npm install`

**WebSocket connection failed**
- Make sure backend (http://localhost:8000) is running
- Check CORS settings in main.py

### File Structure

```
vision-of-imposter/
├── backend/                # Python FastAPI server
│   ├── app/
│   │   ├── models.py      # Game data models
│   │   ├── game_logic.py  # Game rules
│   │   ├── websocket_manager.py
│   │   └── main.py        # FastAPI app
│   ├── requirements.txt
│   └── run.py
├── frontend/              # React app
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── hooks/         # Custom hooks
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── README.md
└── start-game.bat
```

### Next Steps

- [ ] Test with 3+ players
- [ ] Adjust game settings to preference
- [ ] Deploy to cloud (Heroku, Railway, etc.)
- [ ] Add more word categories
- [ ] Implement leaderboard
- [ ] Add sound effects

### Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review backend logs in terminal 1
3. Check browser console (F12) for frontend errors
4. See README.md for detailed documentation

---

**Enjoy the game!** 🎨🕵️
