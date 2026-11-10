# ============================================================
#  api/auth.py  –  Authentication Endpoints & Dependency
# ============================================================
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional

from database import get_db
from database.models import User
from security import (
    verify_password,
    create_access_token,
    decode_access_token,
    is_rate_limited,
    record_failed_attempt,
    reset_failed_attempts,
    TOKEN_EXPIRY_HOURS
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=200)


class UserResponse(BaseModel):
    id: int
    username: str
    is_active: bool
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


def extract_token_from_request(request: Request) -> Optional[str]:
    """Extract token from Authorization Bearer header or HttpOnly cookie."""
    # 1. Check Authorization header: 'Bearer <token>'
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:].strip()
        if token:
            return token

    # 2. Check HttpOnly cookie
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        return cookie_token

    return None


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Dependency to validate current authenticated user."""
    token = extract_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username = payload["sub"]
    user = db.query(User).filter(User.username == username.lower()).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    """Authenticate user with rate limiting and issue signed JWT."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    clean_username = payload.username.strip().lower()

    if not clean_username or not payload.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid username or password"
        )

    # Brute-force check
    if is_rate_limited(client_ip, clean_username):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please wait 15 minutes before trying again."
        )

    user = db.query(User).filter(User.username == clean_username).first()

    # Generic error message to prevent account enumeration
    if not user or not verify_password(payload.password, user.password_hash) or not user.is_active:
        record_failed_attempt(client_ip, clean_username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    # Success: reset rate limit attempts
    reset_failed_attempts(client_ip, clean_username)

    # Update last login time
    user.last_login_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    # Generate token
    token_data = {"sub": user.username, "uid": user.id}
    access_token = create_access_token(token_data)

    # Set HttpOnly, SameSite=Lax cookie for browser session support
    # Max age in seconds
    max_age_seconds = TOKEN_EXPIRY_HOURS * 3600
    is_production = False  # Keep Secure=False in local dev so cookies persist over http://
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=max_age_seconds,
        expires=max_age_seconds,
        samesite="lax",
        secure=is_production
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "is_active": user.is_active,
            "created_at": user.created_at,
            "last_login_at": user.last_login_at
        }
    }


@router.post("/logout")
def logout(response: Response):
    """Clear session cookie."""
    response.delete_cookie("access_token")
    return {"status": "ok", "message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Return currently authenticated user profile."""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "last_login_at": current_user.last_login_at
    }

