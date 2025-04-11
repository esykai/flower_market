import os

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

import models
from models.database import get_db


SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-here")
ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/google-login")


async def get_current_user(
        db: AsyncSession = Depends(get_db),
        token: str = Depends(oauth2_scheme)
) -> models.User:
    """
    Получает текущего аутентифицированного пользователя на основе JWT токена.

    Args:
        db (AsyncSession): Асинхронная сессия базы данных, полученная через зависимость
        token (str): JWT токен, полученный из заголовка Authorization

    Returns:
        models.User: Объект пользователя с подгруженными связанными данными

    Raises:
        HTTPException: 401 если токен недействителен или пользователь не найден
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError as e:
        raise credentials_exception from e

    result = await db.execute(
        select(models.User)
        .options(
            joinedload(models.User.profile),
            joinedload(models.User.cart_items)
            .joinedload(models.CartItem.flower)
            .joinedload(models.Flower.images),
            joinedload(models.User.favorites)
            .joinedload(models.Favorite.flower)
            .joinedload(models.Flower.images),
            joinedload(models.User.purchases)
            .joinedload(models.Purchase.flower)
            .joinedload(models.Flower.images),
        )
        .where(models.User.id == int(user_id))
    )

    user = result.scalars().first()

    if user is None:
        raise credentials_exception

    return user


async def get_current_admin(
        current_user: models.User = Depends(get_current_user)
) -> models.User:
    """
    Проверяет, является ли текущий пользователь администратором.

    Args:
        current_user (models.User): Текущий аутентифицированный пользователь

    Returns:
        models.User: Объект пользователя, если он администратор

    Raises:
        HTTPException: 403 если у пользователя недостаточно прав
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user