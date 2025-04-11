from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from models.database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    google_id = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
    cart_items = relationship("CartItem", back_populates="user")
    favorites = relationship("Favorite", back_populates="user")
    profile = relationship("UserProfile", uselist=False, back_populates="user")
    purchases = relationship("Purchase", back_populates="user")


class UserProfile(Base):
    __tablename__ = "user_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    address = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    telegram = Column(String, nullable=True)
    user = relationship("User", back_populates="profile")