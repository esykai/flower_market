from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

import schemas
import models
from dependencies.auth import get_current_user, get_db
from services.flower_service import FlowerService

router = APIRouter(prefix="/cart", tags=["cart"])


@router.get("/", response_model=list[schemas.CartItem])
async def get_user_cart(
    user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Получение списка элементов в корзине пользователя.

    Args:
        user (models.User): Текущий пользователь из зависимости get_current_user.
        db (AsyncSession): Асинхронная сессия базы данных.

    Returns:
        list[schemas.CartItem]: Список элементов корзины или пустой список, если корзина пуста.
    """
    cart_items = await FlowerService.get_cart(db, user.id)
    return cart_items if cart_items else []


@router.post("/{flower_id}", response_model=schemas.CartItem)
async def add_to_cart(
    flower_id: int,
    quantity: int,
    user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Добавление цветка в корзину пользователя.

    Args:
        flower_id (int): ID цветка для добавления.
        quantity (int): Количество цветков.
        user (models.User): Текущий пользователь из зависимости get_current_user.
        db (AsyncSession): Асинхронная сессия базы данных.

    Returns:
        schemas.CartItem: Добавленный элемент корзины.

    Raises:
        HTTPException: 400 если цветок недоступен или недостаточно количества.
    """
    cart_item = await FlowerService.add_to_cart(db, user.id, flower_id, quantity)
    if not cart_item:
        raise HTTPException(
            status_code=400, detail="Flower not available or insufficient quantity"
        )
    return cart_item


@router.delete("/{cart_item_id}", response_model=dict)
async def remove_from_cart(
    cart_item_id: int,
    user: models.User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Удаление элемента из корзины пользователя.

    Args:
        cart_item_id (int): ID элемента корзины для удаления.
        user (models.User): Текущий пользователь из зависимости get_current_user.
        db (AsyncSession): Асинхронная сессия базы данных.

    Returns:
        dict: Сообщение об успешном удалении.

    Raises:
        HTTPException: 404 если элемент корзины не найден.
    """
    if await FlowerService.remove_from_cart(db, user.id, cart_item_id):
        return {"message": "Item removed from cart"}
    raise HTTPException(status_code=404, detail="Cart item not found")


@router.get("/purchases", response_model=list[schemas.Purchase])
async def get_purchases(
    user: models.User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Получение списка покупок пользователя.

    Args:
        user (models.User): Текущий пользователь из зависимости get_current_user.
        db (AsyncSession): Асинхронная сессия базы данных.

    Returns:
        list[schemas.Purchase]: Список покупок или пустой список, если покупок нет.
    """
    purchases = await FlowerService.get_purchases(db, user.id)
    return purchases if purchases else []