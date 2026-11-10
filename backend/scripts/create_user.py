#!/usr/bin/env python3
# ============================================================
#  scripts/create_user.py  –  CLI User Management Script
# ============================================================
import sys
import getpass
import pathlib

# Ensure backend root is on Python path
backend_dir = pathlib.Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from database import SessionLocal, init_db
from database.models import User
from security import hash_password


def create_user():
    print("\n=== Qyndr DoE Studio – User Creation CLI ===")
    init_db()

    username = input("Enter username: ").strip()
    if not username:
        print("Error: Username cannot be empty.")
        sys.exit(1)

    password = getpass.getpass("Enter password: ")
    if not password:
        print("Error: Password cannot be empty.")
        sys.exit(1)

    confirm_password = getpass.getpass("Confirm password: ")
    if password != confirm_password:
        print("Error: Passwords do not match.")
        sys.exit(1)

    clean_user = username.lower()

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == clean_user).first()
        if existing:
            print(f"Error: User '{clean_user}' already exists.")
            sys.exit(1)

        pw_hash = hash_password(password)
        new_user = User(
            username=clean_user,
            password_hash=pw_hash,
            is_active=True
        )
        db.add(new_user)
        db.commit()
        print(f"\n[SUCCESS] User '{clean_user}' created successfully!")
    finally:
        db.close()


if __name__ == "__main__":
    create_user()

