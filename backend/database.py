import os
import uuid
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Text, Integer, ForeignKey, DateTime
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
    parsed_json = Column(Text)  # JSON stored as string
    upload_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="success")

class Ranking(Base):
    __tablename__ = "rankings"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    job_role_id = Column(String, ForeignKey("job_roles.id", ondelete="CASCADE"))
    ran_at = Column(DateTime, default=datetime.utcnow)
    results_json = Column(Text)  # JSON results stored as string

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
