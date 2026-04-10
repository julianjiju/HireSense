import os
import uuid
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Text, Integer, ForeignKey, DateTime, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./hiresense.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class JobRole(Base):
    __tablename__ = "job_roles"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    resume_count = Column(Integer, default=0)

class Resume(Base):
    __tablename__ = "resumes"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    job_role_id = Column(String, ForeignKey("job_roles.id", ondelete="CASCADE"))
    filename = Column(String, nullable=False)
    raw_text = Column(Text)
    parsed_json = Column(Text)  # JSON stored as string — structured profile JSON
    upload_date = Column(DateTime, default=datetime.utcnow)
    batch_label = Column(String(256), default="")
    status = Column(String, default="success")
    storage_path = Column(String, nullable=True)

class Ranking(Base):
    __tablename__ = "rankings"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    job_role_id = Column(String, ForeignKey("job_roles.id", ondelete="CASCADE"))
    ran_at = Column(DateTime, default=datetime.utcnow)
    results_json = Column(Text)  # JSON results stored as string

def _migrate_sqlite_columns():
    """Lightweight ALTER for existing SQLite DBs (create_all does not add columns)."""
    if not str(engine.url).startswith("sqlite"):
        return
    try:
        insp = inspect(engine)
        if "resumes" not in insp.get_table_names():
            return
        cols = {c["name"] for c in insp.get_columns("resumes")}
        with engine.begin() as conn:
            if "batch_label" not in cols:
                conn.execute(text("ALTER TABLE resumes ADD COLUMN batch_label VARCHAR(256) DEFAULT ''"))
            if "storage_path" not in cols:
                conn.execute(text("ALTER TABLE resumes ADD COLUMN storage_path TEXT"))
    except Exception:
        pass


def init_db():
    Base.metadata.create_all(bind=engine)
    _migrate_sqlite_columns()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
