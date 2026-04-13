"""Reexporta schemas Pydantic usados nas rotas da API."""

from app.schemas.produto import (
    ReviewItem,
    ProductUpdate,
    ProductCreate,
    ProductListItem,
    ProductDetailResponse,
    ProductListResponse,
    OrderHistoryItem,
)

__all__ = [
    "ReviewItem",
    "ProductUpdate",
    "ProductCreate",
    "ProductListItem",
    "ProductDetailResponse",
    "ProductListResponse",
    "OrderHistoryItem",
]
