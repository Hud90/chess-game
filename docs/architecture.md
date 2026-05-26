```mermaid
flowchart TD

A[User Browser]
B[Frontend HTML/CSS/JS]
C[Stockfish Web Worker]
D[FastAPI Backend]
E[(PostgreSQL Database)]

A --> B
B --> C
B -->|REST API| D
D --> E
```