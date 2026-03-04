# Vision of Imposter - Game Mechanics & Architecture

## 🎨 Shared Drawing Board System

### **Key Mechanic: One Board, Multiple Drawers**

Instead of each player drawing individually:
- **All players draw on the SAME shared board**
- **Turn-based drawing**: Players take turns drawing ONE line each
- **Real-time synchronization**: Everyone sees the board update as each player draws
- **Progressive reveal**: Drawing builds up line by line as each player takes their turn

## Game Flow

```
START GAME
    ↓
IMPOSTER ASSIGNED (random)
    ↓
ROUND 1
    ├─ Word shown to innocents only
    ├─ Imposter gets dummy word
    │
    ├─ DRAWING PHASE (Turn-based)
    │  ├─ Player 1: Draws 1 line → shared board updates
    │  ├─ Player 2: Draws 1 line → shared board updates
    │  ├─ Player 3: Draws 1 line → shared board updates
    │  └─ Player 4: Draws 1 line → move to CHAT
    │
    ├─ CHAT PHASE (2 min default)
    │  ├─ All players discuss
    │  ├─ Players accuse/defend
    │  └─ Timer expires → move to VOTING
    │
    └─ VOTING PHASE
       ├─ All vote for who they think is imposter
       ├─ Votes revealed
       └─ If imposter voted out → Innocents WIN
          Else → Next round
    ↓
REPEAT (up to N rounds)
    ↓
FINAL VOTE
    ↓
RESULTS SCREEN
```

## Key Improvements Over Individual Drawings

| Aspect | Individual Canvas | Shared Board |
|--------|-------------------|--------------|
| **Deduction** | Hard to see patterns | Easy to spot imposter behavior |
| **Turn order** | Simultaneous | Sequential (fair play) |
| **Engagement** | Less interactive | Everyone watching always |
| **Strategy** | Just draw your word | Can draw to mislead/deduce |
| **Social** | Less discussion | More discussion needed |

## Turn-Based Drawing System

### How It Works

1. **Game Starts**
   - Players assigned roles (innocent/imposter)
   - Player order randomized
   - Word selected randomly
   - Drawing board initialized (empty)

2. **First Player's Turn**
   - 20 second timer starts (default, configurable)
   - Only **Player 1** can draw
   - Everyone else watches in real-time
   - Player 1 draws ONE line, then submits

3. **Line Submitted**
   - Line added to shared board
   - All players see updated board
   - Auto-move to next player's turn
   - Board keeps all previous lines

4. **Next Players**
   - Repeat for each player
   - Each adds one line to the shared art
   - After last player: move to CHAT phase

## WebSocket Events

### Player Drawing Their Line
```json
{
  "type": "submit_drawing",
  "line_data": {
    "points": [[x1, y1], [x2, y2], ...],
    "color": "#000",
    "width": 3
  }
}
```

### Server Response - Drawing Updated
```json
{
  "type": "drawing_updated",
  "drawing_data": "[{...line1...}, {...line2...}]",
  "drew_by": "player_id",
  "player_name": "Alice"
}
```

### Next Player's Turn
```json
{
  "type": "next_drawer",
  "drawer_id": "player_id_3",
  "drawing_data": "[{...lines_so_far...}]",
  "round_progress": "3/4"
}
```

### All Players Have Drew
```json
{
  "type": "all_drawings_submitted",
  "drawing_data": "[{...all_lines...}]",
  "chat_duration": 120
}
```

## Backend Architecture

### Models (`models.py`)
```python
Room:
  - player_order: List[str]        # Ordered IDs for turn-based drawing
  - current_drawer_index: int       # Who's drawing now
  - shared_drawing_data: str        # JSON of all lines drawn
  - drawing_time_limit: int         # Seconds per player (default 20)
  - get_current_drawer_id() -> str  # Get current player's ID
```

### Game Logic (`game_logic.py`)
- `assign_imposters()` - Random role assignment
- `start_game()` - Initialize player order & board
- `next_drawer()` - Move to next player, returns False if all drew
- `add_line_to_shared_board()` - Append line to JSON
- `next_round()` - Prepare for next round

### WebSocket Handlers (`main.py`)
- `submit_drawing` - Accept line from current drawer
- Auto-advance to next drawer when submitted
- Broadcast drawing updates to all players

## Frontend Components

### Canvas Component
```jsx
Props:
  - isYourTurn: bool           // Can you draw?
  - currentDrawerName: string  // Who's drawing
  - drawingData: string        // JSON of all lines
  - drawingTimeLimit: int      // Time left
  - onSubmit(lineData)         // Called when you submit

Features:
  - Shows existing board
  - Only allows drawing if isYourTurn
  - Countdown timer
  - Prevents multiple lines
  - Clear & Submit buttons
```

### Game State
```javascript
{
  // ... other state
  sharedDrawingData: '[]',      // JSON of lines
  currentDrawerId: null,         // Who's drawing
  currentDrawerName: '',         // Display name
  isYourTurn: false,            // Can you draw?
  roundProgress: '0/0',         // 1/4, 2/4, etc
}
```

## Gameplay Strategy

### As an Innocent
- Draw clearly to help others understand
- Look for patterns in others' drawings
- After voting: Say why you think someone is imposter

### As an Imposter  
- Try to draw something plausible
- Don't need to match the word (no one will say it)
- Watch what innocents draw
- In chat, ask leading questions
- Deny being imposter confidently

## Configuration Options

**Room Host Can Set:**
- Number of imposters (1-5)
- Rounds before voting (1-10)
- Chat duration per round (30-300 seconds)
- Drawing time per player (10-60 seconds) - can be added

## UV Usage

Project uses **uv** for fast Python dependency management:

```bash
# Run with auto-dependency installation
uv run python run.py

# Or specify dependencies
uv run --with fastapi --with uvicorn python -m app.main
```

This means:
- ✅ No need for virtual environments
- ✅ Dependencies auto-installed
- ✅ Fast startup
- ✅ No requirements.txt needed (but provided for compatibility)

## Future Enhancements

- [ ] Configurable drawing time per player
- [ ] Line undo for current drawer
- [ ] Drawing preview before submit
- [ ] Color selection for lines
- [ ] Line thickness selection
- [ ] Player avatars on board
- [ ] Spectator mode for disconnected players
- [ ] Mobile drawing support
- [ ] Persistent drawing history per player
- [ ] Leaderboard system
- [ ] Custom word categories
