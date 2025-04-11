from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

import schemas
from dependencies.auth import get_current_admin, get_db
from services.flower_service import FlowerService

router = APIRouter(prefix="/flowers", tags=["flowers"])


@router.post(
    "/", response_model=schemas.Flower, dependencies=[Depends(get_current_admin)]
)
async def create_flower(
    name: str = Form(...),
    category: str = Form(...),
    price: float = Form(...),
    quantity: int = Form(...),
    size: str = Form(...),
    tips: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    images: list[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    """Создание нового цветка (только для администратора).

    Args:
        name (str): Название цветка.
        category (str): Категория цветка.
        price (float): Цена цветка.
        quantity (int): Количество цветков.
        size (str): Размер цветка.
        tips (Optional[str]): Советы по уходу (опционально).
        description (Optional[str]): Описание цветка (опционально).
        images (list[UploadFile]): Список изображений цветка (опционально).
        db (AsyncSession): Асинхронная сессия базы данных.

    Returns:
        schemas.Flower: Созданный цветок.
    """
    flower_data = schemas.FlowerCreate(
        name=name,
        category=category,
        price=price,
        quantity=quantity,
        size=size,
        tips=tips,
        description=description,
    )
    return await FlowerService.create_flower(db, flower_data, images)


@router.get("/", response_model=list[schemas.Flower])
async def get_flowers(db: AsyncSession = Depends(get_db)):
    """Получение списка всех доступных цветков.

    Args:
        db (AsyncSession): Асинхронная сессия базы данных.

    Returns:
        list[schemas.Flower]: Список всех цветков.
    """
    return await FlowerService.get_all_flowers(db)


@router.get("/{flower_id}", response_model=schemas.Flower)
async def get_flower(flower_id: int, db: AsyncSession = Depends(get_db)):
    """Получение информации о конкретном цветке по ID.

    Args:
        flower_id (int): ID цветка.
        db (AsyncSession): Асинхронная сессия базы данных.

    Returns:
        schemas.Flower: Данные о цветке.

    Raises:
        HTTPException: 404 если цветок не найден.
    """
    flower = await FlowerService.get_flower(db, flower_id)
    if not flower:
        raise HTTPException(status_code=404, detail="Flower not found")
    return flower


@router.put(
    "/{flower_id}",
    response_model=schemas.Flower,
    dependencies=[Depends(get_current_admin)],
)
async def update_flower(
    flower_id: int,
    name: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    price: Optional[float] = Form(None),
    quantity: Optional[int] = Form(None),
    size: Optional[str] = Form(None),
    tips: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    images: list[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    """Обновление информации о цветке (только для администратора).

    Args:
        flower_id (int): ID цветка для обновления.
        name (Optional[str]): Новое название (опционально).
        category (Optional[str]): Новая категория (опционально).
        price (Optional[float]): Новая цена (опционально).
        quantity (Optional[int]): Новое количество (опционально).
        size (Optional[str]): Новый размер (опционально).
        tips (Optional[str]): НовალწყარაკიNew tips (optional).
        description (Optional[str]): Новое описание (опционально).
        images (list[UploadFile]): Новые изображения (опционально).
        db (AsyncSession): Асинхронная сессия базы данных.

    Returns:
        schemas.Flower: Обновленный цветок.

    Raises:
        HTTPException: 404 если цветок не найден.
    """
    flower_data = schemas.FlowerUpdate(
        name=name,
        category=category,
        price=price,
        quantity=quantity,
        size=size,
        tips=tips,
        description=description,
    )
    updated_flower = await FlowerService.update_flower(db, flower_id, flower_data, images)
    if not updated_flower:
        raise HTTPException(status_code=404, detail="Flower not found")
    return updated_flower


@router.delete("/{flower_id}", dependencies=[Depends(get_current_admin)])
async def delete_flower(flower_id: int, db: AsyncSession = Depends(get_db)):
    """Удаление цветка (только для администратора).

    Args:
        flower_id (int): ID цветка для удаления.
        db (AsyncSession): Асинхронная сессия базы данных.

    Returns:
        dict: Сообщение об успешном удалении.

    Raises:
        HTTPException: 404 если цветок не найден.
    """
    if not await FlowerService.delete_flower(db, flower_id):
        raise HTTPException(status_code=404, detail="Flower not found")
    return {"message": "Flower deleted successfully"}


@router.delete(
    "/{flower_id}/images/{image_id}", dependencies=[Depends(get_current_admin)]
)
async def delete_flower_image(
    flower_id: int, image_id: int, db: AsyncSession = Depends(get_db)
):
    """Удаление изображения цветка (только для администратора).

    Args:
        flower_id (int): ID цветка.
        image_id (int): ID изображения для удаления.
        db (AsyncSession): Асинхронная сессия базы данных.

    Returns:
        dict: Сообщение об успешном удалении.

    Raises:
        HTTPException: 404 если изображение не найдено.
    """
    if not await FlowerService.delete_image(db, flower_id, image_id):
        raise HTTPException(status_code=404, detail="Image not found")
    return {"message": "Image deleted successfully"}