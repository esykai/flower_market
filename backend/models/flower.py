from sqlalchemy import Column, Float, Integer, String
from sqlalchemy.orm import relationship

from models.database import Base


class Flower(Base):
    __tablename__ = "flowers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False)
    size = Column(String, nullable=False)
    tips = Column(String)
    description = Column(String)
    images = relationship(
        "FlowerImage", back_populates="flower", cascade="all, delete-orphan"
    )
    cart_items = relationship(
        "CartItem", back_populates="flower", cascade="all, delete-orphan"
    )
    favorites = relationship(
        "Favorite", back_populates="flower", cascade="all, delete-orphan"
    )
    purchases = relationship(
        "Purchase", back_populates="flower", cascade="all, delete-orphan"
    )