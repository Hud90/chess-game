from pydantic import BaseModel


class UserCreate(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    username: str
    password: str


class GameCreate(BaseModel):
    pgn: str
    result: str

    difficulty: int | None = None
    move_count: int | None = None
    player_accuracy: float | None = None
    completion_time: int | None = None
    opening: str | None = None


class GameResponse(BaseModel):
    id: int
    pgn: str
    result: str

    difficulty: int | None
    move_count: int | None
    player_accuracy: float | None
    completion_time: int | None
    opening: str | None

    class Config:
        from_attributes = True