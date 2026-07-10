from datetime import datetime

from sqlalchemy import Column
from sqlalchemy import DateTime
from sqlalchemy import Integer
from sqlalchemy import String
from sqlalchemy import Text
from sqlalchemy import ForeignKey
from sqlalchemy import Float
from sqlalchemy.sql import func

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    username = Column(String, unique=True, nullable=False)

    password_hash = Column(String, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id")
    )

    pgn = Column(Text)

    result = Column(String)

    difficulty = Column(Integer, nullable=True)

    move_count = Column(Integer, nullable=True)

    player_accuracy = Column(Float, nullable=True)

    completion_time = Column(Integer, nullable=True)

    opening = Column(String, nullable=True)

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )