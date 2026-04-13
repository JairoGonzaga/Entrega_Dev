"""Configura motor, sessoes e base declarativa do SQLAlchemy."""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """
    Fornece uma sessao do banco via dependencia do FastAPI.
    Fecha a sessao ao final do request, mesmo em erro.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
