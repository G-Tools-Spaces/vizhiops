"""Set (or reset) the email/password login for an existing user.

The admin console (vizhi-admin) signs in with email + password only, so an
account created with Google sign-in needs a password before it can use it.
The password is read with a hidden prompt, never from the command line, so it
does not end up in shell history.

Usage:
    DATABASE_URL='<same url as the server>' .venv/bin/python set_password.py you@example.com
"""

from __future__ import annotations

import asyncio
import getpass
import sys
import uuid

from sqlalchemy import select

from app.auth.user_auth import hash_password, normalize_email
from app.db.session import async_session_factory, engine
from app.models.db_models import AuthAccountRow, UserRow

MIN_LENGTH = 8  # same rule as /v1/auth/signup


def _read_password() -> str:
    password = getpass.getpass("New password: ")
    if len(password) < MIN_LENGTH:
        sys.exit(f"❌ Password must be at least {MIN_LENGTH} characters.")
    if getpass.getpass("Repeat password: ") != password:
        sys.exit("❌ Passwords do not match.")
    return password


async def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("Usage: python set_password.py <email>")
    email = normalize_email(sys.argv[1])

    async with async_session_factory() as db:
        user = (await db.execute(select(UserRow).where(UserRow.email == email))).scalar_one_or_none()
        if user is None:
            sys.exit(f"❌ No user found with email {email!r} — sign in to the main console first.")

        password_hash = hash_password(_read_password())
        account = (
            await db.execute(
                select(AuthAccountRow).where(
                    AuthAccountRow.user_id == user.id,
                    AuthAccountRow.provider == "password",
                )
            )
        ).scalar_one_or_none()
        if account is None:
            db.add(
                AuthAccountRow(
                    id=f"auth_{uuid.uuid4().hex[:12]}",
                    user_id=user.id,
                    provider="password",
                    provider_user_id=None,
                    password_hash=password_hash,
                )
            )
            action = "added"
        else:
            account.password_hash = password_hash
            action = "reset"
        await db.commit()

    await engine.dispose()
    print(f"✅ Password login {action} for {email} (role={user.role!r}). Google sign-in still works.")


if __name__ == "__main__":
    asyncio.run(main())
