import asyncio
import os
import uuid
from typing import Optional

import aiofiles
from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

import models
import schemas


class FlowerService:
    @staticmethod
    async def create_flower(
        db: AsyncSession,
        flower: schemas.FlowerCreate,
        image_files: Optional[list[UploadFile]] = None,
    ) -> models.Flower:
        """Создание нового цветка с возможностью загрузки изображений.

        Args:
            db (AsyncSession): Асинхронная сессия базы данных.
            flower (schemas.FlowerCreate): Данные для создания цветка.
            image_files (Optional[list[UploadFile]]): Список файлов изображений (опционально).

        Returns:
            models.Flower: Созданный объект цветка с подгруженными изображениями.
        """
        db_flower = models.Flower(**flower.dict())
        if image_files:
            static_dir = "static"
            if not os.path.exists(static_dir):
                os.makedirs(static_dir, exist_ok=True)

            for file in image_files:
                file_extension = os.path.splitext(file.filename)[1]
                unique_filename = f"{uuid.uuid4()}{file_extension}"
                file_path = os.path.join(static_dir, unique_filename)

                async with aiofiles.open(file_path, "wb") as buffer:
                    content = await file.read()
                    await buffer.write(content)

                db_flower.images.append(models.FlowerImage(image_path=unique_filename))

        db.add(db_flower)
        await db.commit()
        await db.refresh(db_flower)

        result = await db.execute(
            select(models.Flower)
            .options(joinedload(models.Flower.images))
            .where(models.Flower.id == db_flower.id)
        )
        return result.scalar()

    @staticmethod
    async def get_flower(db: AsyncSession, flower_id: int) -> Optional[models.Flower]:
        """Получение цветка по ID с подгруженными изображениями.

        Args:
            db (AsyncSession): Асинхронная сессия базы данных.
            flower_id (int): ID цветка.

        Returns:
            Optional[models.Flower]: Объект цветка или None, если не найден.
        """
        result = await db.execute(
            select(models.Flower)
            .options(joinedload(models.Flower.images))
            .where(models.Flower.id == flower_id)
        )
        return result.scalar()

    @staticmethod
    async def get_all_flowers(db: AsyncSession) -> list[models.Flower]:
        """Получение списка всех цветков с подгруженными изображениями.

        Args:
            db (AsyncSession): Асинхронная сессия базы данных.

        Returns:
            list[models.Flower]: Список всех цветков.
        """
        result = await db.execute(
            select(models.Flower).options(joinedload(models.Flower.images))
        )

        return result.unique().scalars().all()

    @staticmethod
    async def update_flower(
        db: AsyncSession,
        flower_id: int,
        flower: schemas.FlowerUpdate,
        image_files: Optional[list[UploadFile]] = None,
    ) -> Optional[models.Flower]:
        """Обновление информации о цветке с возможностью добавления изображений.

        Args:
            db (AsyncSession): Асинхронная сессия базы данных.
            flower_id (int): ID цветка для обновления.
            flower (schemas.FlowerUpdate): Данные для обновления.
            image_files (Optional[list[UploadFile]]): Список новых файлов изображений (опционально).

        Returns:
            Optional[models.Flower]: Обновленный объект цветка или None, если не найден.
        """
        db_flower = await FlowerService.get_flower(db, flower_id)
        if not db_flower:
            return None

        update_data = flower.dict(exclude_none=True)
        for key, value in update_data.items():
            setattr(db_flower, key, value)

        if image_files:
            static_dir = "static"
            if not os.path.exists(static_dir):
                os.makedirs(static_dir, exist_ok=True)

            existing_image_filenames = {img.image_path for img in db_flower.images}

            for file in image_files:
                if not file.filename:
                    continue

                file_extension = os.path.splitext(file.filename)[1]
                unique_filename = f"{uuid.uuid4()}{file_extension}"
                file_path = os.path.join(static_dir, unique_filename)

                if unique_filename not in existing_image_filenames:
                    async with aiofiles.open(file_path, "wb") as buffer:
                        content = await file.read()
                        await buffer.write(content)
                    db_flower.images.append(models.FlowerImage(image_path=unique_filename))
                    existing_image_filenames.add(unique_filename)

        await db.commit()
        await db.refresh(db_flower)

        result = await db.execute(
            select(models.Flower)
            .options(joinedload(models.Flower.images))
            .where(models.Flower.id == db_flower.id)
        )
        return result.scalar()

    @staticmethod
    async def delete_flower(db: AsyncSession, flower_id: int) -> bool:
        """Удаление цветка и связанных с ним изображений.

        Args:
            db (AsyncSession): Асинхронная сессия базы данных.
            flower_id (int): ID цветка для удаления.

        Returns:
            bool: True если удаление успешно, False если цветок не найден.
        """
        db_flower = await FlowerService.get_flower(db, flower_id)
        if db_flower:
            for image in db_flower.images:
                file_path = os.path.join("static", image.image_path)
                if os.path.exists(file_path):
                    await asyncio.to_thread(os.remove, file_path)
            await db.delete(db_flower)
            await db.commit()
            return True
        return False

    @staticmethod
    async def delete_image(db: AsyncSession, flower_id: int, image_id: int) -> bool:
        """Удаление конкретного изображения цветка.

        Args:
            db (AsyncSession): Асинхронная сессия базы данных.
            flower_id (int): ID цветка.
            image_id (int): ID изображения для удаления.

        Returns:
            bool: True если удаление успешно, False если изображение или цветок не найдены.
        """
        db_flower = await FlowerService.get_flower(db, flower_id)
        if db_flower:
            image = next((img for img in db_flower.images if img.id == image_id), None)
            if image:
                file_path = os.path.join("static", image.image_path)
                if os.path.exists(file_path):
                    await asyncio.to_thread(os.remove, file_path)
                await db.delete(image)
                await db.commit()
                return True
        return False

    @staticmethod
    async def add_to_cart(
        db: AsyncSession, user_id: int, flower_id: int, quantity: int
    ) -> Optional[models.CartItem]:
        """Добавление цветка в корзину пользователя.

        Args:
            db (AsyncSession): Асинхронная сессия базы данных.
            user_id (int): ID пользователя.
            flower_id (int): ID цветка.
            quantity (int): Количество для добавления.

        Returns:
            Optional[models.CartItem]: Объект элемента корзины или None, если цветок недоступен.
        """
        db_flower = await FlowerService.get_flower(db, flower_id)
        if not db_flower or db_flower.quantity < quantity:
            return None

        result = await db.execute(
            select(models.CartItem)
            .options(joinedload(models.CartItem.flower))
            .where(models.CartItem.user_id == user_id)
            .where(models.CartItem.flower_id == flower_id)
        )
        cart_item = result.scalar()

        if cart_item:
            cart_item.quantity += quantity
        else:
            cart_item = models.CartItem(
                user_id=user_id, flower_id=flower_id, quantity=quantity
            )
            db.add(cart_item)

        await db.commit()
        await db.refresh(cart_item)

        result = await db.execute(
            select(models.CartItem)
            .options(joinedload(models.CartItem.flower).joinedload(models.Flower.images))
            .where(models.CartItem.id == cart_item.id)
        )
        return result.scalar()

    @staticmethod
    async def remove_from_cart(db: AsyncSession, user_id: int, cart_item_id: int) -> bool:
        """Удаление элемента из корзины пользователя.

        Args:
            db (AsyncSession): Асинхронная сессия базы данных.
            user_id (int): ID пользователя.
            cart_item_id (int): ID элемента корзины.

        Returns:
            bool: True если удаление успешно, False если элемент не найден.
        """
        result = await db.execute(
            select(models.CartItem)
            .where(models.CartItem.id == cart_item_id)
            .where(models.CartItem.user_id == user_id)
        )
        cart_item = result.scalar()
        if cart_item:
            await db.delete(cart_item)
            await db.commit()
            return True
        return False

    @staticmethod
    async def get_cart(db: AsyncSession, user_id: int) -> list[models.CartItem]:
        """Получение списка элементов корзины пользователя.

        Args:
            db (AsyncSession): Асинхронная сессия базы данных.
            user_id (int): ID пользователя.

        Returns:
            list[models.CartItem]: Список элементов корзины с подгруженными цветками.
        """
        result = await db.execute(
            select(models.CartItem)
            .options(joinedload(models.CartItem.flower).joinedload(models.Flower.images))
            .where(models.CartItem.user_id == user_id)
        )

        return result.unique().scalars().all()

    @staticmethod
    async def add_to_favorites(
        db: AsyncSession, user_id: int, flower_id: int
    ) -> models.Favorite:
        """Добавление цветка в избранное пользователя.

        Args:
            db (AsyncSession): Асинхронная сессия базы данных.
            user_id (int): ID пользователя.
            flower_id (int): ID цветка.

        Returns:
            models.Favorite: Объект избранного с подгруженным цветком.
        """
        result = await db.execute(
            select(models.Favorite)
            .options(joinedload(models.Favorite.flower).joinedload(models.Flower.images))
            .where(models.Favorite.user_id == user_id)
            .where(models.Favorite.flower_id == flower_id)
        )
        favorite = result.scalar()
        if not favorite:
            favorite = models.Favorite(user_id=user_id, flower_id=flower_id)
            db.add(favorite)
            await db.commit()
            await db.refresh(favorite)

        result = await db.execute(
            select(models.Favorite)
            .options(joinedload(models.Favorite.flower).joinedload(models.Flower.images))
            .where(models.Favorite.id == favorite.id)
        )
        return result.scalar()

    @staticmethod
    async def remove_from_favorites(
        db: AsyncSession, user_id: int, flower_id: int
    ) -> bool:
        """Удаление цветка из избранного пользователя.

        Args:
            db (AsyncSession): Асинхронная сессия базы данных.
            user_id (int): ID пользователя.
            flower_id (int): ID цветка.

        Returns:
            bool: True если удаление успешно, False если элемент не найден.
        """
        result = await db.execute(
            select(models.Favorite)
            .where(models.Favorite.user_id == user_id)
            .where(models.Favorite.flower_id == flower_id)
        )
        favorite = result.scalar()
        if favorite:
            await db.delete(favorite)
            await db.commit()
            return True
        return False

    @staticmethod
    async def get_favorites(db: AsyncSession, user_id: int) -> list[models.Favorite]:
        """Получение списка избранных цветков пользователя.

        Args:
            db (AsyncSession): Асинхронная сессия базы данных.
            user_id (int): ID пользователя.

        Returns:
            list[models.Favorite]: Список избранных цветков с подгруженными данными.
        """
        result = await db.execute(
            select(models.Favorite)
            .options(joinedload(models.Favorite.flower).joinedload(models.Flower.images))
            .where(models.Favorite.user_id == user_id)
        )

        return result.unique().scalars().all()

    @staticmethod
    async def get_purchases(db: AsyncSession, user_id: int) -> list[models.Purchase]:
        """Получение списка покупок пользователя.

        Args:
            db (AsyncSession): Асинхронная сессия базы данных.
            user_id (int): ID пользователя.

        Returns:
            list[models.Purchase]: Список покупок с подгруженными цветками.
        """
        result = await db.execute(
            select(models.Purchase)
            .options(joinedload(models.Purchase.flower).joinedload(models.Flower.images))
            .where(models.Purchase.user_id == user_id)
        )

        return result.unique().scalars().all()