from pydantic import BaseModel

from .flower import Flower


class FavoriteBase(BaseModel):
    flower_id: int


class Favorite(FavoriteBase):
    id: int
    user_id: int
    flower: Flower

    class Config:
        from_attributes = True