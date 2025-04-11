from pydantic import BaseModel

from .flower import Flower


class CartItemBase(BaseModel):
    flower_id: int
    quantity: int


class CartItem(CartItemBase):
    id: int
    user_id: int
    flower: Flower

    class Config:
        from_attributes = True