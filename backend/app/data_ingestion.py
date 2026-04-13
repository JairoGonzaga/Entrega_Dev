"""Faz ingestao de CSVs em lote para popular o banco de dados."""

from __future__ import annotations

import csv
from datetime import date, datetime
from pathlib import Path
from typing import Iterable

from sqlalchemy import func, insert, select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.avaliacao_pedido import OrderReview
from app.models.consumidor import Customer
from app.models.item_pedido import OrderItem
from app.models.pedido import Order
from app.models.produto import Product
from app.models.vendedor import Seller

BATCH_SIZE = 5000


def _parse_float(value: str | None) -> float | None:
    """
    Converte string para float respeitando valores vazios.
    Retorna None quando a entrada e nula ou so tem espacos.
    """
    if value is None:
        return None

    normalized = value.strip()
    if not normalized:
        return None

    return float(normalized)


def _parse_int(value: str | None) -> int | None:
    """
    Converte string para int respeitando valores vazios.
    Retorna None quando a entrada e nula ou so tem espacos.
    """
    if value is None:
        return None

    normalized = value.strip()
    if not normalized:
        return None

    return int(normalized)


def _parse_datetime(value: str | None) -> datetime | None:
    """
    Converte string ISO para datetime quando possivel.
    Retorna None para valores vazios ou ausentes.
    """
    if value is None:
        return None

    normalized = value.strip()
    if not normalized:
        return None

    return datetime.fromisoformat(normalized)


def _parse_date(value: str | None) -> date | None:
    """
    Converte string ISO para date quando possivel.
    Retorna None para valores vazios ou ausentes.
    """
    if value is None:
        return None

    normalized = value.strip()
    if not normalized:
        return None

    return date.fromisoformat(normalized)


def _iter_csv_rows(file_path: Path) -> Iterable[dict[str, str]]:
    """
    Itera um CSV e entrega cada linha como dicionario.
    Usa encoding utf-8-sig para lidar com BOM.
    """
    with file_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            yield row


def _insert_in_batches(
    db: Session,
    model: type,
    rows: Iterable[dict],
    batch_size: int = BATCH_SIZE,
) -> int:
    """
    Insere registros em lotes para reduzir custo de transacao.
    Usa OR IGNORE para evitar falhas quando ja existem dados.
    """
    batch: list[dict] = []
    inserted = 0

    for row in rows:
        batch.append(row)
        if len(batch) >= batch_size:
            db.execute(insert(model).prefix_with("OR IGNORE"), batch)
            inserted += len(batch)
            batch.clear()

    if batch:
        db.execute(insert(model).prefix_with("OR IGNORE"), batch)
        inserted += len(batch)

    return inserted


def _build_price_stats(order_items_csv: Path) -> dict[str, tuple[float, int]]:
    """
    Calcula estatisticas de preco por id_produto.
    Retorna soma e contagem para derivar preco medio.
    """
    stats: dict[str, tuple[float, int]] = {}

    for row in _iter_csv_rows(order_items_csv):
        product_id = row["id_produto"].strip()
        price = _parse_float(row.get("preco_BRL"))
        if price is None:
            continue

        total, count = stats.get(product_id, (0.0, 0))
        stats[product_id] = (total + price, count + 1)

    return stats


def _default_description(category: str) -> str:
    """
    Gera uma descricao padrao legivel a partir da categoria.
    Substitui underscores por espacos e normaliza o texto.
    """
    label = category.replace("_", " ").strip()
    return f"Item da categoria {label}."


def _data_dir() -> Path:
    """
    Resolve o caminho da pasta raiz de dados de ingestao.
    Assume a estrutura padrao do repositorio do projeto.
    """
    repo_root = Path(__file__).resolve().parents[2]
    return repo_root / "data_ingestao"


def populate_db_from_csv() -> bool:
    """
    Popula tabelas a partir dos CSVs se ainda estiverem vazias.
    Retorna False quando arquivos faltam ou quando ja ha dados.
    """
    data_dir = _data_dir()
    if not data_dir.exists():
        return False

    products_csv = data_dir / "dim_produtos.csv"
    customers_csv = data_dir / "dim_consumidores.csv"
    sellers_csv = data_dir / "dim_vendedores.csv"
    orders_csv = data_dir / "fat_pedidos.csv"
    order_items_csv = data_dir / "fat_itens_pedidos.csv"
    reviews_csv = data_dir / "fat_avaliacoes_pedidos.csv"

    required_files = [
        products_csv,
        customers_csv,
        sellers_csv,
        orders_csv,
        order_items_csv,
        reviews_csv,
    ]

    if any(not file_path.exists() for file_path in required_files):
        return False

    with SessionLocal() as db:
        table_counts = {
            "customers": db.scalar(select(func.count()).select_from(Customer)) or 0,
            "sellers": db.scalar(select(func.count()).select_from(Seller)) or 0,
            "products": db.scalar(select(func.count()).select_from(Product)) or 0,
            "orders": db.scalar(select(func.count()).select_from(Order)) or 0,
            "order_items": db.scalar(select(func.count()).select_from(OrderItem)) or 0,
            "reviews": db.scalar(select(func.count()).select_from(OrderReview)) or 0,
        }
        if all(count > 0 for count in table_counts.values()):
            return False

        price_stats = _build_price_stats(order_items_csv)

        _insert_in_batches(
            db,
            Customer,
            (
                {
                    "customer_id": row["id_consumidor"],
                    "zip_prefix": row["prefixo_cep"],
                    "customer_name": row["nome_consumidor"],
                    "cidade": row["cidade"],
                    "estado": row["estado"],
                }
                for row in _iter_csv_rows(customers_csv)
            ),
        )
        db.commit()

        _insert_in_batches(
            db,
            Seller,
            (
                {
                    "seller_id": row["id_vendedor"],
                    "seller_name": row["nome_vendedor"],
                    "zip_prefix": row["prefixo_cep"],
                    "cidade": row["cidade"],
                    "estado": row["estado"],
                }
                for row in _iter_csv_rows(sellers_csv)
            ),
        )
        db.commit()

        _insert_in_batches(
            db,
            Product,
            (
                {
                    "product_id": row["id_produto"],
                    "product_name": row["nome_produto"],
                    "product_category": row["categoria_produto"],
                    "product_description": _default_description(row["categoria_produto"]),
                    "base_price": (
                        round(
                            price_stats[row["id_produto"]][0]
                            / price_stats[row["id_produto"]][1],
                            2,
                        )
                        if row["id_produto"] in price_stats
                        else None
                    ),
                    "product_weight_grams": _parse_float(row.get("peso_produto_gramas")),
                    "length_cm": _parse_float(row.get("comprimento_centimetros")),
                    "height_cm": _parse_float(row.get("altura_centimetros")),
                    "width_cm": _parse_float(row.get("largura_centimetros")),
                }
                for row in _iter_csv_rows(products_csv)
            ),
        )
        db.commit()

        _insert_in_batches(
            db,
            Order,
            (
                {
                    "order_id": row["id_pedido"],
                    "customer_id": row["id_consumidor"],
                    "status": row["status"],
                    "purchase_timestamp": _parse_datetime(row.get("pedido_compra_timestamp")),
                    "delivered_timestamp": _parse_datetime(row.get("pedido_entregue_timestamp")),
                    "estimated_delivery_date": _parse_date(row.get("data_estimada_entrega")),
                    "delivery_days": _parse_float(row.get("tempo_entrega_dias")),
                    "estimated_delivery_days": _parse_float(row.get("tempo_entrega_estimado_dias")),
                    "delivery_delay_days": _parse_float(row.get("diferenca_entrega_dias")),
                    "on_time_delivery": row["entrega_no_prazo"],
                }
                for row in _iter_csv_rows(orders_csv)
            ),
        )
        db.commit()

        _insert_in_batches(
            db,
            OrderItem,
            (
                {
                    "order_id": row["id_pedido"],
                    "item_id": _parse_int(row.get("id_item")),
                    "product_id": row["id_produto"],
                    "seller_id": row["id_vendedor"],
                    "price_brl": _parse_float(row.get("preco_BRL")),
                    "freight_price": _parse_float(row.get("preco_frete")),
                }
                for row in _iter_csv_rows(order_items_csv)
            ),
        )
        db.commit()

        _insert_in_batches(
            db,
            OrderReview,
            (
                {
                    "review_id": row["id_avaliacao"],
                    "order_id": row["id_pedido"],
                    "rating": _parse_int(row.get("avaliacao")),
                    "comment_title": row["titulo_comentario"],
                    "comment": row["comentario"],
                    "comment_date": _parse_datetime(row.get("data_comentario")),
                    "response_date": _parse_datetime(row.get("data_resposta")),
                }
                for row in _iter_csv_rows(reviews_csv)
            ),
        )
        db.commit()

    return True
