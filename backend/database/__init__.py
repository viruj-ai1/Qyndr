# ============================================================
#  database/__init__.py  –  DB session factory
# ============================================================
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os, pathlib
from dotenv import load_dotenv

load_dotenv(pathlib.Path(__file__).parent.parent / ".env")

_backend_dir = pathlib.Path(__file__).resolve().parent.parent
_env_db = os.getenv("DATABASE_URL")
if not _env_db or _env_db == "sqlite:///./doe_workflow.db":
    DATABASE_URL = f"sqlite:///{(_backend_dir / 'doe_workflow.db').as_posix()}"
else:
    DATABASE_URL = _env_db

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
                    "locked_campaigns": "TEXT DEFAULT '[]'",
                    "api_targets": "TEXT DEFAULT '[]'",
                    "step_statuses": "TEXT DEFAULT '{}'",
                    "unlocked_step": "TEXT DEFAULT NULL"
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

        # 6. Legacy Risk Parameters Data Migration:
        # Preserve finished/scored rows as 'confirmed', collapse doubled words in names (e.g. "Reaction Reaction Temperature")
        try:
            import json, re
            db_proj_rows = conn.execute(text("SELECT id, risk_assessment_data FROM projects WHERE risk_assessment_data IS NOT NULL")).fetchall()
            for p_id, raw_risk in db_proj_rows:
                if not raw_risk or raw_risk == "{}":
                    continue
                try:
                    risk_dict = json.loads(raw_risk) if isinstance(raw_risk, str) else raw_risk
                    modified = False
                    for stage_id, stage_val in risk_dict.items():
                        params = stage_val.get("parameters", []) if isinstance(stage_val, dict) else []
                        for param in params:
                            old_name = param.get("name", "")
                            # Collapse duplicate consecutive words (e.g. "Reaction Reaction ...")
                            new_name = re.sub(r'\b(\w+)\s+\1\b', r'\1', old_name, flags=re.IGNORECASE)
                            if new_name != old_name:
                                param["name"] = new_name
                                modified = True
                            # Set status: if already scored, mark 'confirmed', else 'suggested'
                            if "status" not in param:
                                if param.get("severity") is not None and param.get("occurrence") is not None and param.get("detectability") is not None:
                                    param["status"] = "confirmed"
                                else:
                                    param["status"] = "suggested"
                                modified = True
                    if modified:
                        conn.execute(
                            text("UPDATE projects SET risk_assessment_data = :data WHERE id = :pid"),
                            {"data": json.dumps(risk_dict), "pid": p_id}
                        )
                except Exception:
                    pass
            conn.commit()
        except Exception as mig_err:
            print("Risk parameter legacy migration notice:", mig_err)

    # Admin Bootstrap / Sync from .env or default credentials
    admin_user = (os.getenv("ADMIN_USERNAME", "").strip() or "R&D_Lab_Head")
    admin_pass = (os.getenv("ADMIN_PASSWORD", "").strip() or "R&D_Lab_Head@VG.in")
    if admin_user and admin_pass:
        from .models import User
        from security import hash_password, verify_password
        db = SessionLocal()
        try:
            normalized_username = admin_user.lower()
            existing = db.query(User).filter(User.username == normalized_username).first()
            if not existing:
                u = User(
                    username=normalized_username,
                    password_hash=hash_password(admin_pass),
                    is_active=True
                )
                db.add(u)
                db.commit()
                print(f"  [BOOTSTRAP] Initial admin user '{normalized_username}' created.")
            elif not verify_password(admin_pass, existing.password_hash):
                existing.password_hash = hash_password(admin_pass)
                existing.is_active = True
                db.commit()
                print(f"  [BOOTSTRAP] Admin user '{normalized_username}' password updated from environment/defaults.")
        except Exception as bootstrap_err:
            print("Bootstrap admin notice:", bootstrap_err)
        finally:
            db.close()


