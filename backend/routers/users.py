from fastapi import APIRouter
from fastapi import Depends
from fastapi import Header
from fastapi import HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from database import get_db
from models import User
from schemas import UserCreate
from security import hash_password
from security import verify_password
from security import create_access_token
from security import get_current_user
from security import verify_token

router = APIRouter(
    prefix="/users",
    tags=["users"]
)


@router.post("/")
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db)
):

    new_user = User(
        username=user.username,
        password_hash=hash_password(user.password)
    )

    db.add(new_user)

    try:
        db.commit()

    except IntegrityError:

        db.rollback()

        raise HTTPException(
            status_code=400,
            detail="Username already exists"
        )

    db.refresh(new_user)

    return {
        "id": new_user.id,
        "username": new_user.username
    }


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):

    statement = select(User).where(
        User.username == form_data.username
    )

    existing_user = db.scalar(statement)

    if not existing_user:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    valid_password = verify_password(
        form_data.password,
        existing_user.password_hash
    )

    if not valid_password:
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    access_token = create_access_token(
        data={
            "sub": existing_user.username
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.get("/me")
def read_current_user(
    current_user: str = Depends(get_current_user)
):

    return {
        "username": current_user
    }

