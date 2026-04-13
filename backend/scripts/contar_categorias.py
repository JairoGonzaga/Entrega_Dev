from pathlib import Path
import sys

from sqlalchemy import func, select

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database import SessionLocal
from app.models.produto import Product


def list_categories(db):
    category_col = func.trim(Product.product_category)
    rows = db.execute(
        select(category_col.label("categoria_produto"))
        .distinct()
        .where(category_col.is_not(None))
        .where(category_col != "")
        .order_by(category_col)
    ).all()
    return [row.categoria_produto for row in rows]


def main():
    db = SessionLocal()
    try:
        categories = list_categories(db)
        print("total_categories", len(categories))
        print("first", categories[:10])
    finally:
        db.close()


if __name__ == "__main__":
    main()
