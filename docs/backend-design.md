# System Overview

Frontend
- HTML/CSS/JavaScript chess client

Backend
- FastAPI (Python REST API)

Database
- PostgreSQL

# Core Data Models

User
- id
- username
- password_hash
- created_at
Game
- id
- user_id
- fen
- pgn
- result
- status
- created_at
Move (Optional Future Optimization)
- id
- game_id
- move_number
- san_notation
- fen_after
- created_at

# API Endpoints (Draft)

## Authentication
POST /auth/register
POST /auth/login
POST /auth/logout

## Games
POST /games
GET /games/{id}
POST /games/{id}/move
GET /games/history

## Social/Stats
GET /leaderboard

# Authentication Notes

- Passwords will be hashed with bcrypt
- JWT tokens planned for session authentication

# Architecture Notes

- Frontend communicates with FastAPI via REST API
- PostgreSQL stores persistent user and game data
- Stockfish currently runs client-side in the browser
- Backend is responsible for authentication and persistence

# Future Considerations

- Multiplayer via WebSockets
- Server-side Stockfish analysis
- Elo/rating system
- Matchmaking
- Puzzle generation
- Cloud save synchronization