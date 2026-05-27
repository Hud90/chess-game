from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import users

from database import engine
from models import Base

Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(users.router)

origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Chess backend running"}


@app.get("/health")
def health():
    return {"status": "ok"}