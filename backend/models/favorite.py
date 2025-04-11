from sqlalchemy import Column, ForeignKey, Integer
from sqlalchemy.orm import relationship

from models.database import Base


class Favorite(Base):
    __tablename__ = "favorites"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    flower_id = Column(Integer, ForeignKey("flowers.id"), nullable=False)
    user = relationship("User", back_populates="favorites")
    flower = relationship("Flower", back_populates="favorites")