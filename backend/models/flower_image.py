from sqlalchemy import Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from models.database import Base


class FlowerImage(Base):
    __tablename__ = "flower_images"
    id = Column(Integer, primary_key=True, index=True)
    flower_id = Column(Integer, ForeignKey("flowers.id"), nullable=False)
    image_path = Column(String, nullable=False)
    flower = relationship("Flower", back_populates="images")