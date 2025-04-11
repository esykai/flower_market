from typing import Optional

from pydantic import BaseModel


class FlowerImage(BaseModel):
    id: int
    image_path: str

    class Config:
        from_attributes = True


class FlowerBase(BaseModel):
    name: str
    category: str
    price: float
    quantity: int
    size: str
    tips: Optional[str] = None
    description: Optional[str] = None


class FlowerCreate(FlowerBase):
    pass


class FlowerUpdate(FlowerBase):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    quantity: Optional[int] = None
    size: Optional[str] = None


class Flower(FlowerBase):
    id: int
    images: list[FlowerImage] = []

    class Config:
        from_attributes = True