from sqlalchemy import Column, ForeignKey, Integer
from sqlalchemy.orm import relationship

from models.database import Base


class CartItem(Base):
    __tablename__ = "cart_items"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    flower_id = Column(Integer, ForeignKey("flowers.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    user = relationship("User", back_populates="cart_items")
    flower = relationship("Flower", back_populates="cart_items")