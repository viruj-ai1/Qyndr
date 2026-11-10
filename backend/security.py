# ============================================================
#  security.py  –  Authentication, JWT & Security Helpers
# ============================================================
import os
import time
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import jwt, JWTError

JWT_SECRET = os.getenv("JWT_SECRET", "qyndr_default_dev_secret_key_change_in_production_384729482")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
TOKEN_EXPIRY_HOURS = int(os.getenv("TOKEN_EXPIRY_HOURS", "8"))

# In-memory rate limiting store: key -> list of timestamp failures
# Key format: f"{ip}:{username.lower()}"
_FAILED_LOGIN_ATTEMPTS: Dict[str, list] = {}
RATE_LIMIT_WINDOW_SECONDS = 5 * 60  # 5 minutes
MAX_FAILED_ATTEMPTS = 15


def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    if not password:
        raise ValueError("Password cannot be empty")
    pw_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash."""
    if not plain_password or not hashed_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=TOKEN_EXPIRY_HOURS))
    to_encode.update({"exp": expire, "iat": datetime.utcnow()})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate JWT access token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


def is_rate_limited(ip: str, username: str) -> bool:
    """Check if login attempts exceed threshold in the rate limit window."""
    clean_ip = ip or "127.0.0.1"
    clean_user = (username or "").strip().lower()
    key = f"{clean_ip}:{clean_user}"
    now = time.time()

    attempts = _FAILED_LOGIN_ATTEMPTS.get(key, [])
    # Keep only attempts within the window
    valid_attempts = [t for t in attempts if now - t < RATE_LIMIT_WINDOW_SECONDS]
    _FAILED_LOGIN_ATTEMPTS[key] = valid_attempts

    return len(valid_attempts) >= MAX_FAILED_ATTEMPTS


def record_failed_attempt(ip: str, username: str):
    """Record a failed login attempt for rate limiting."""
    clean_ip = ip or "127.0.0.1"
    clean_user = (username or "").strip().lower()
    key = f"{clean_ip}:{clean_user}"
    now = time.time()

    attempts = _FAILED_LOGIN_ATTEMPTS.get(key, [])
    attempts.append(now)
    _FAILED_LOGIN_ATTEMPTS[key] = [t for t in attempts if now - t < RATE_LIMIT_WINDOW_SECONDS]


def reset_failed_attempts(ip: str, username: str):
    """Reset failed attempts upon successful login."""
    clean_ip = ip or "127.0.0.1"
    clean_user = (username or "").strip().lower()
    key = f"{clean_ip}:{clean_user}"
    if key in _FAILED_LOGIN_ATTEMPTS:
        del _FAILED_LOGIN_ATTEMPTS[key]

