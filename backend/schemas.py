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


class GameResponse(BaseModel):
    id: int
    pgn: str
    result: str

    class Config:
        from_attributes = True