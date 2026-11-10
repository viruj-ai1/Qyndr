# ============================================================
#  tests/test_auth.py  –  Authentication API Tests
# ============================================================
import pytest
import sys
import os
import pathlib
from fastapi.testclient import TestClient

backend_dir = pathlib.Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app import app
from database import SessionLocal, init_db
from database.models import User
from security import hash_password, create_access_token, _FAILED_LOGIN_ATTEMPTS
from datetime import timedelta

client = TestClient(app)

TEST_USER = "auth_test_user"
TEST_PASS = "ValidPassword123!"


@pytest.fixture(autouse=True)
def setup_test_user():
    """Ensure a clean test user exists for each test run."""
    init_db()
    _FAILED_LOGIN_ATTEMPTS.clear()
    db = SessionLocal()
    try:
        # Delete existing test user if present
        existing = db.query(User).filter(User.username == TEST_USER.lower()).first()
        if existing:
            db.delete(existing)
            db.commit()

        # Create fresh test user
        user = User(
            username=TEST_USER.lower(),
            password_hash=hash_password(TEST_PASS),
            is_active=True
        )
        db.add(user)
        db.commit()
    finally:
        db.close()

    yield

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == TEST_USER.lower()).first()
        if existing:
            db.delete(existing)
            db.commit()
    finally:
        db.close()


def test_login_successful():
    """Test successful login with username and password."""
    resp = client.post("/api/auth/login", json={
        "username": TEST_USER,
        "password": TEST_PASS
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == TEST_USER.lower()
    # Check that HttpOnly cookie was set
    assert "access_token" in resp.cookies


def test_login_case_insensitive():
    """Test login is case-insensitive for username."""
    resp = client.post("/api/auth/login", json={
        "username": TEST_USER.upper(),
        "password": TEST_PASS
    })
    assert resp.status_code == 200
    assert resp.json()["user"]["username"] == TEST_USER.lower()


def test_login_wrong_password():
    """Test that wrong password returns generic 401 error."""
    resp = client.post("/api/auth/login", json={
        "username": TEST_USER,
        "password": "IncorrectPassword"
    })
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid username or password"


def test_login_unknown_user():
    """Test that nonexistent user returns identical generic 401 error."""
    resp = client.post("/api/auth/login", json={
        "username": "completely_unknown_user_9999",
        "password": "SomePassword"
    })
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid username or password"


def test_protected_route_without_token():
    """Test that accessing protected endpoint without token returns 401."""
    # Ensure client has no auth cookie
    client.cookies.clear()
    resp = client.get("/api/projects")
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Authentication required"


def test_get_me_with_valid_bearer_token():
    """Test /api/auth/me with Bearer token in header."""
    login_resp = client.post("/api/auth/login", json={
        "username": TEST_USER,
        "password": TEST_PASS
    })
    token = login_resp.json()["access_token"]

    # Clear cookies to strictly verify Bearer header
    client.cookies.clear()
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["username"] == TEST_USER.lower()


def test_expired_token_returns_401():
    """Test that an expired JWT token returns 401."""
    expired_token = create_access_token(
        {"sub": TEST_USER.lower()},
        expires_delta=timedelta(seconds=-10)
    )
    client.cookies.clear()
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert resp.status_code == 401
    assert "Invalid or expired" in resp.json()["detail"]


def test_rate_limiting_after_repeated_failures():
    """Test that 5 failed attempts trigger a 429 Too Many Requests."""
    for i in range(5):
        resp = client.post("/api/auth/login", json={
            "username": TEST_USER,
            "password": f"wrong_{i}"
        })
        assert resp.status_code == 401

    # 6th attempt should return 429
    blocked_resp = client.post("/api/auth/login", json={
        "username": TEST_USER,
        "password": TEST_PASS
    })
    assert blocked_resp.status_code == 429
    assert "Too many failed login attempts" in blocked_resp.json()["detail"]


def test_public_health_and_root():
    """Test that public endpoints remain accessible without auth."""
    client.cookies.clear()
    resp_root = client.get("/")
    assert resp_root.status_code == 200

    resp_health = client.get("/api/health")
    assert resp_health.status_code == 200
    assert resp_health.json()["status"] == "ok"

