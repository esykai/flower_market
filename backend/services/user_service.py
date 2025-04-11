from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

import models
import schemas


class UserService:
    @staticmethod
    async def get_user_by_google_id(
        db: AsyncSession, google_id: str
    ) -> Optional[models.User]:
        """Получение пользователя по Google ID.

        Args:
            db (AsyncSession): Асинхронная сессия базы данных.
            google_id (str): Google ID пользователя.

        Returns:
            Optional[models.User]: Объект пользователя с профилем или None, если не найден.
        """
        result = await db.execute(
            select(models.User)
            .options(joinedload(models.User.profile))
            .where(models.User.google_id == google_id)
        )
        return result.scalars().first()

    @staticmethod
    async def create_user(
        db: AsyncSession, google_id: str, email: str, name: str
    ) -> models.User:
        """Создание нового пользователя.

        Args:
            db (AsyncSession): Асинхронная сессия базы данных.
            google_id (str): Google ID пользователя.
            email (str): Электронная почта пользователя.
            name (str): Имя пользователя.

        Returns:
            models.User: Созданный объект пользователя с подгруженным профилем.
        """
        db_user = models.User(google_id=google_id, email=email, name=name)
        db.add(db_user)
        await db.commit()
        await db.refresh(db_user)

        result = await db.execute(
            select(models.User)
            .options(joinedload(models.User.profile))
            .where(models.User.id == db_user.id)
        )
        return result.scalars().first()

    @staticmethod
    async def get_or_create_profile(
        db: AsyncSession, user_id: int
    ) -> models.UserProfile:
        """Получение или создание профиля пользователя.

        Args:
            db (AsyncSession): Асинхронная сессия базы данных.
            user_id (int): ID пользователя.

        Returns:
            models.UserProfile: Объект профиля с подгруженным пользователем.
        """
        result = await db.execute(
            select(models.UserProfile)
            .options(joinedload(models.UserProfile.user))
            .where(models.UserProfile.user_id == user_id)
        )
        profile = result.scalars().first()
        if not profile:
            profile = models.UserProfile(user_id=user_id)
            db.add(profile)
            await db.commit()
            await db.refresh(profile)

            result = await db.execute(
                select(models.UserProfile)
                .options(joinedload(models.UserProfile.user))
                .where(models.UserProfile.id == profile.id)
            )
            profile = result.scalars().first()
        return profile

    @staticmethod
    async def update_profile(
        db: AsyncSession, user_id: int, profile_data: schemas.UserProfileUpdate
    ) -> models.UserProfile:
        """Обновление профиля пользователя.

        Args:
            db (AsyncSession): Асинхронная сессия базы данных.
            user_id (int): ID пользователя.
            profile_data (schemas.UserProfileUpdate): Данные для обновления профиля.

        Returns:
            models.UserProfile: Обновленный объект профиля с подгруженным пользователем.
        """
        profile = await UserService.get_or_create_profile(db, user_id)
        for key, value in profile_data.dict(exclude_unset=True).items():
            setattr(profile, key, value)
        await db.commit()
        await db.refresh(profile)

        result = await db.execute(
            select(models.UserProfile)
            .options(joinedload(models.UserProfile.user))
            .where(models.UserProfile.id == profile.id)
        )
        return result.scalars().first()