from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

import schemas
import models
from dependencies.auth import get_current_user, get_db
from services.flower_service import FlowerService

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("/", response_model=list[schemas.Favorite])
async def get_user_favorites(
    user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Получение списка избранных цветков пользователя.

    Args:
        user (models.User): Текущий пользователь из зависимости get_current_user.
        db (AsyncSession): Асинхронная сессия базы данных.

    Returns:
        list[schemas.Favorite]: Список избранных цветков или пустой список, если их нет.
    """
    favorites = await FlowerService.get_favorites(db, user.id)
    return favorites if favorites else []


@router.post("/{flower_id}", response_model=schemas.Favorite)
async def add_to_favorites(
    flower_id: int,
    user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Добавление цветка в избранное пользователя.

    Args:
        flower_id (int): ID цветка для добавления в избранное.
        user (models.User): Текущий пользователь из зависимости get_current_user.
        db (AsyncSession): Асинхронная сессия базы данных.

    Returns:
        schemas.Favorite: Добавленный элемент избранного.
    """
    favorite = await FlowerService.add_to_favorites(db, user.id, flower_id)
    return favorite


@router.delete("/{flower_id}", response_model=dict)
async def remove_from_favorites(
    flower_id: int,
    user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Удаление цветка из избранного пользователя.

    Args:
        flower_id (int): ID цветка для удаления из избранного.
        user (models.User): Текущий пользователь из зависимости get_current_user.
        db (AsyncSession): Асинхронная сессия базы данных.

    Returns:
        dict: Сообщение об успешном удалении.

    Raises:
        HTTPException: 404 если элемент избранного не найден.
    """
    if await FlowerService.remove_from_favorites(db, user.id, flower_id):
        return {"message": "Item removed from favorites"}
    raise HTTPException(status_code=404, detail="Favorite not found")