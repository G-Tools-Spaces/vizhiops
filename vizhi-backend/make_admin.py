"""Promote a user to admin (can manage the model catalog via /v1/admin/catalog/*).

Usage:
    .venv/bin/python make_admin.py you@example.com          # promote
    .venv/bin/python make_admin.py you@example.com --demote # back to regular user
"""

from __future__ import annotations

import asyncio
import sys

from sqlalchemy import update

from app.db.session import engine
from app.models.db_models import UserRow


async def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("Usage: python make_admin.py <email> [--demote]")

    email = sys.argv[1].strip().lower()
    role = "user" if "--demote" in sys.argv else "admin"

    async with engine.begin() as conn:
        result = await conn.execute(
            update(UserRow).where(UserRow.email == email).values(role=role)
        )
        if result.rowcount == 0:
            sys.exit(f"❌ No user found with email {email!r} — sign up first.")
    print(f"✅ {email} is now role={role!r}")


if __name__ == "__main__":
    asyncio.run(main())
