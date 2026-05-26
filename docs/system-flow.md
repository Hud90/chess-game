# System Flow

## Singleplayer Move Flow

1. User makes a move on the frontend chess board
2. Frontend validates move locally with chess.js
3. Frontend sends move data to FastAPI backend
4. Backend validates request structure
5. Backend stores updated game state in PostgreSQL
6. Backend returns updated game data
7. Frontend updates UI
8. Stockfish calculates response move
9. Frontend applies Stockfish move
10. Frontend optionally syncs new state to backend

---

## Authentication Flow

1. User submits login form
2. Frontend sends credentials to backend
3. Backend validates credentials
4. Password hash checked against database
5. JWT token returned to frontend
6. Frontend stores token for authenticated requests

---

## Future Multiplayer Flow

1. Player creates match
2. Backend creates game session
3. Opponent joins session
4. Moves transmitted via WebSocket
5. Backend synchronizes game state between players