# ============================================================
#  database/__init__.py  –  DB session factory
# ============================================================
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os, pathlib
from dotenv import load_dotenv

load_dotenv(pathlib.Path(__file__).parent.parent / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./doe_workflow.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    from .models import Base
    from sqlalchemy import text
    Base.metadata.create_all(bind=engine)

    # Auto-migrate SQLite columns if upgrading existing database file
    with engine.connect() as conn:
        try:
            # 1. projects table
            res = conn.execute(text("PRAGMA table_info(projects)"))
            existing_cols = [r[1] for r in res.fetchall()]
            if existing_cols:
                new_cols = {
                    "qtpp_data": "TEXT DEFAULT '[]'",
                    "cqas_data": "TEXT DEFAULT '[]'",
                    "stages_data": "TEXT DEFAULT '[]'",
                    "risk_assessment_data": "TEXT DEFAULT '{}'",
                    "audit_logs": "TEXT DEFAULT '[]'",
                    "locked_campaigns": "TEXT DEFAULT '[]'"
                }
                for col_name, col_type in new_cols.items():
                    if col_name not in existing_cols:
                        conn.execute(text(f"ALTER TABLE projects ADD COLUMN {col_name} {col_type}"))

            # 2. factors table
            res_f = conn.execute(text("PRAGMA table_info(factors)"))
            f_cols = [r[1] for r in res_f.fetchall()]
            if f_cols:
                if "stage_id" not in f_cols:
                    conn.execute(text("ALTER TABLE factors ADD COLUMN stage_id TEXT"))
                if "is_hard_to_change" not in f_cols:
                    conn.execute(text("ALTER TABLE factors ADD COLUMN is_hard_to_change INTEGER DEFAULT 0"))
                if "linked_cqa_ids" not in f_cols:
                    conn.execute(text("ALTER TABLE factors ADD COLUMN linked_cqa_ids TEXT DEFAULT '[]'"))

            # 3. responses table
            res_r = conn.execute(text("PRAGMA table_info(responses)"))
            r_cols = [r[1] for r in res_r.fetchall()]
            if r_cols:
                if "stage_id" not in r_cols:
                    conn.execute(text("ALTER TABLE responses ADD COLUMN stage_id TEXT"))
                if "linked_cqa_ids" not in r_cols:
                    conn.execute(text("ALTER TABLE responses ADD COLUMN linked_cqa_ids TEXT DEFAULT '[]'"))

            # 4. experiments table
            res_e = conn.execute(text("PRAGMA table_info(experiments)"))
            e_cols = [r[1] for r in res_e.fetchall()]
            if e_cols:
                if "stage_id" not in e_cols:
                    conn.execute(text("ALTER TABLE experiments ADD COLUMN stage_id TEXT"))

            # 5. analyses table
            res_a = conn.execute(text("PRAGMA table_info(analyses)"))
            a_cols = [r[1] for r in res_a.fetchall()]
            if a_cols:
                if "stage_id" not in a_cols:
                    conn.execute(text("ALTER TABLE analyses ADD COLUMN stage_id TEXT"))

            conn.commit()
        except Exception as e:
            print("Auto-migration check notice:", e)


