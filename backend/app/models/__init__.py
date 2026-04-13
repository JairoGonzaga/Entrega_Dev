"""Importa modelos para registro no SQLAlchemy e Alembic."""

# Importa todos os models para que o SQLAlchemy e o Alembic os registrem
from app.models.consumidor import Customer
from app.models.produto import Product
from app.models.vendedor import Seller
from app.models.pedido import Order
from app.models.item_pedido import OrderItem
from app.models.avaliacao_pedido import OrderReview

__all__ = [
    "Customer",
    "Product",
    "Seller",
    "Order",
    "OrderItem",
    "OrderReview",
]
