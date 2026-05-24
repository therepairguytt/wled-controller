import os
from urllib.parse import quote_plus
from sqlmodel import create_engine, Session
from dotenv import load_dotenv

load_dotenv()

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")

# Defaulting to an in-memory SQLite database if no user is provided, to avoid crash if env vars are missing
if DB_USER and DB_PASSWORD:
    password = quote_plus(DB_PASSWORD)
    DATABASE_URL = f"postgresql://{DB_USER}:{password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
else:
    DATABASE_URL = "sqlite:///database.db"

engine = create_engine(DATABASE_URL, echo=False)

def get_session():
    with Session(engine) as session:
        yield session
