from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session
from sqlalchemy import select

from database import get_db

from models import Game
from models import User

from schemas import GameCreate

from security import get_current_user


router = APIRouter(
    prefix="/games",
    tags=["games"]
)


@router.post("/save")
def save_game(
    game: GameCreate,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    statement = select(User).where(
        User.username == current_user
    )

    user = db.scalar(statement)

    new_game = Game(
        user_id=user.id,
        pgn=game.pgn,
        result=game.result
    )

    db.add(new_game)

    db.commit()

    db.refresh(new_game)

    return {
        "message": "Game saved",
        "game_id": new_game.id
    }


@router.get("/my-games")
def get_my_games(
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    statement = select(User).where(
        User.username == current_user
    )

    user = db.scalar(statement)

    statement = select(Game).where(
        Game.user_id == user.id
    )

    games = db.scalars(statement).all()

    return games


@router.delete("/{game_id}")
def delete_game(
    game_id: int,
    current_user: str = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    # get user
    statement = select(User).where(User.username == current_user)
    user = db.scalar(statement)

    # find game owned by user
    statement = select(Game).where(
        Game.id == game_id,
        Game.user_id == user.id
    )

    game = db.scalar(statement)

    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    db.delete(game)
    db.commit()

    return {
        "message": "Game deleted",
        "game_id": game_id
    }