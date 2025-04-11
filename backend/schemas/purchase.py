from datetime import datetime

from pydantic import BaseModel

from .flower import Flower


class PurchaseBase(BaseModel):
    quantity: int
    total_price: float
    purchase_date: datetime


class Purchase(PurchaseBase):
    id: int
    user_id: int
    flower: Flower

    class Config:
        from_attributes = True