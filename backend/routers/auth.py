import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from google.auth.transport import requests
from google.oauth2 import id_token
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

import schemas
import models
from dependencies.auth import get_current_user, get_db
from services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "31231232-dsadasds.apps.googleusercontent.com")
ADMIN_EMAILS = [email.strip() for email in os.getenv("ADMIN_EMAILS", "esykaidev@gmail.com").split(",")]


@router.post("/google-login", response_model=dict)
async def google_login(
    data: schemas.GoogleLoginRequest, db: AsyncSession = Depends(get_db)
):
    """Аутентификация пользователя через Google OAuth2 и выдача JWT токена.

    Args:
        data (schemas.GoogleLoginRequest): Данные запроса с Google токеном.
        db (AsyncSession): Асинхронная сессия базы данных.

    Returns:
        dict: Словарь с access_token и token_type.

    Raises:
        HTTPException: 401 если Google токен недействителен, 500 при прочих ошибках.
    """
    try:
        idinfo = id_token.verify_oauth2_token(
            data.token, requests.Request(), GOOGLE_CLIENT_ID
        )
        google_id = idinfo["sub"]
        email = idinfo["email"]
        name = idinfo.get("name", "")

        user = await UserService.get_user_by_google_id(db, google_id)
        if not user:
            user = await UserService.create_user(db, google_id, email, name)
            if email in ADMIN_EMAILS:
                user.is_admin = True
                await db.commit()
                await db.refresh(user)

        payload = {
            "sub": str(user.id),
            "email": user.email,
            "name": user.name,
            "is_admin": user.is_admin,
            "exp": datetime.utcnow() + timedelta(hours=24 * 30),
        }
        access_token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

        return {"access_token": access_token, "token_type": "bearer"}
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@router.get("/me", response_model=schemas.User)
async def get_profile(
    user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Получение профиля текущего аутентифицированного пользователя.

    Args:
        user (models.User): Текущий пользователь из зависимости get_current_user.
        db (AsyncSession): Асинхронная сессия базы данных.

    Returns:
        schemas.User: Данные пользователя.
    """
    return user


@router.put("/profile", response_model=schemas.UserProfile)
async def update_user_profile(
    profile_data: schemas.UserProfileUpdate,
    user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновление профиля текущего пользователя.

    Args:
        profile_data (schemas.UserProfileUpdate): Данные для обновления профиля.
        user (models.User): Текущий пользователь из зависимости get_current_user.
        db (AsyncSession): Асинхронная сессия базы данных.

    Returns:
        schemas.UserProfile: Обновленный профиль пользователя.

    Raises:
        HTTPException: 500 при ошибке обновления профиля.
    """
    try:
        updated_profile = await UserService.update_profile(db, user.id, profile_data)
        return updated_profile
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Ошибка при обновлении профиля: {str(e)}"
        )