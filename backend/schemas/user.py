from typing import Optional

from pydantic import BaseModel

from .cart_item import CartItem
from .favorite import Favorite
from .purchase import Purchase


class UserProfileBase(BaseModel):
    address: Optional[str] = None
    phone: Optional[str] = None
    telegram: Optional[str] = None


class UserProfileCreate(UserProfileBase):
    pass


class UserProfileUpdate(UserProfileBase):
    pass


class UserProfile(UserProfileBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True


class User(BaseModel):
    id: int
    google_id: str
    email: str
    name: str
    is_admin: bool
    cart_items: list[CartItem] = []
    favorites: list[Favorite] = []
    profile: Optional[UserProfile] = None
    purchases: list[Purchase] = []

    class Config:
        from_attributes = True