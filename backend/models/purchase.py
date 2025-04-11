from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import relationship

from models.database import Base


class Purchase(Base):
    __tablename__ = "purchases"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    flower_id = Column(Integer, ForeignKey("flowers.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    total_price = Column(Float, nullable=False)
    purchase_date = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="purchases")
    flower = relationship("Flower", back_populates="purchases")