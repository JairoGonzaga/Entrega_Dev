"""Product endpoints: filters, details, categories, and CRUD."""

from uuid import uuid4
import csv
from functools import lru_cache
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Path as PathParam, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.avaliacao_pedido import OrderReview
from app.models.item_pedido import OrderItem
from app.models.pedido import Order
from app.models.produto import Product
from app.schemas.produto import (
    ReviewItem,
    OrderHistoryItem,
    ProductUpdate,
    ProductCreate,
    ProductListItem,
    ProductDetailResponse,
    ProductListResponse,
)

router = APIRouter(prefix="/produtos", tags=["Produtos"])

ID_PATTERN = "^[0-9a-f]{32}$"


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _round_2(value: float | None) -> float | None:
    """
    Arredonda valores numericos para 2 casas decimais.
    Preserva None quando nao ha valor calculado.
    """
    return round(value, 2) if value is not None else None


def _normalized_name(column):
    """
    Normaliza o nome do produto removendo aspas e espacos duplicados.
    Ajuda a agrupar produtos semelhantes com grafias inconsistentes.
    """
    return func.trim(func.replace(func.replace(column, '"', ""), "  ", " "))


def _get_product_or_404(product_id: str, db: Session) -> Product:
    """
    Busca um produto pelo id, garantindo resposta 404 se nao existir.
    Evita repeticao de logica de validacao nas rotas.
    """
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Produto nao encontrado")
    return product


def _product_to_list_item(product: Product) -> ProductListItem:
    """
    Converte um Produto em um item resumido do catalogo.
    Mantem valores essenciais para listagens e respostas de CRUD.
    """
    return ProductListItem(
        id_produto=product.product_id,
        nome_produto=product.product_name,
        categoria_produto=product.product_category,
        descricao_produto=product.product_description,
        preco_base=product.base_price,
        media_avaliacoes=None,
        total_vendas=0,
    )


# ---------------------------------------------------------------------------
# Subqueries / CTEs
# ---------------------------------------------------------------------------


def _group_products_base():
    """
    Monta um CTE com produtos agrupados por nome e categoria.
    Calcula medias e contagens para suportar listagens agregadas.
    """
    normalized_name = _normalized_name(Product.product_name)
    return (
        select(
            func.min(Product.product_id).label("id_produto"),
            normalized_name.label("nome_produto"),
            Product.product_category.label("categoria_produto"),
            func.max(Product.product_description).label("descricao_produto"),
            func.avg(Product.base_price).label("preco_base"),
            func.avg(Product.product_weight_grams).label("peso_produto_gramas"),
            func.avg(Product.length_cm).label("comprimento_centimetros"),
            func.avg(Product.height_cm).label("altura_centimetros"),
            func.avg(Product.width_cm).label("largura_centimetros"),
            func.count(Product.product_id).label("quantidade_registros"),
        )
        .select_from(Product)
        .group_by(normalized_name, Product.product_category)
        .cte("produtos_agrupados")
    )


def _subquery_grouped_review_average():
    """
    Calcula a media de avaliacoes por nome normalizado e categoria.
    Usa joins entre itens, pedidos e avaliacoes.
    """
    normalized_name = _normalized_name(Product.product_name)
    return (
        select(
            normalized_name.label("nome_produto"),
            Product.product_category.label("categoria_produto"),
            func.avg(OrderReview.rating).label("media_avaliacoes"),
        )
        .select_from(OrderItem)
        .join(Product, Product.product_id == OrderItem.product_id)
        .join(Order, Order.order_id == OrderItem.order_id)
        .join(OrderReview, OrderReview.order_id == Order.order_id)
        .group_by(normalized_name, Product.product_category)
        .subquery()
    )


def _subquery_grouped_total_sales():
    """
    Conta a quantidade de vendas por nome normalizado e categoria.
    A contagem considera itens de pedido registrados.
    """
    normalized_name = _normalized_name(Product.product_name)
    return (
        select(
            normalized_name.label("nome_produto"),
            Product.product_category.label("categoria_produto"),
            func.count(OrderItem.item_id).label("total_vendas"),
        )
        .select_from(OrderItem)
        .join(Product, Product.product_id == OrderItem.product_id)
        .group_by(normalized_name, Product.product_category)
        .subquery()
    )


def _product_group_by_id(product_id: str, db: Session):
    """
    Resolve nome e categoria normalizados a partir de um id.
    Permite reutilizar os agrupamentos para detalhes do produto.
    """
    normalized_name = _normalized_name(Product.product_name)
    return db.execute(
        select(normalized_name.label("nome_produto"), Product.product_category.label("categoria_produto"))
        .where(Product.product_id == product_id)
    ).first()


def _payload_to_model_fields(data: dict[str, object]) -> dict[str, object]:
    """Mapeia campos do payload (PT) para atributos internos do model (EN)."""
    field_map = {
        "nome_produto": "product_name",
        "categoria_produto": "product_category",
        "descricao_produto": "product_description",
        "preco_base": "base_price",
        "peso_produto_gramas": "product_weight_grams",
        "comprimento_centimetros": "length_cm",
        "altura_centimetros": "height_cm",
        "largura_centimetros": "width_cm",
    }
    return {field_map[key]: value for key, value in data.items() if key in field_map}


def _apply_product_filters(query, columns, search, category, min_price, max_price):
    """
    Aplica filtros de busca textual, categorias e faixa de preco.
    Reaproveitado em consultas de listagem e contagem.
    """
    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                columns.nome_produto.ilike(term),
                columns.categoria_produto.ilike(term),
                columns.descricao_produto.ilike(term),
            )
        )

    if category:
        normalized_categories = [v.strip() for v in category if v and v.strip()]
        if normalized_categories:
            query = query.where(columns.categoria_produto.in_(normalized_categories))

    if min_price is not None:
        query = query.where(columns.preco_base >= min_price)

    if max_price is not None:
        query = query.where(columns.preco_base <= max_price)

    return query


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=ProductListResponse)
def list_products(
    busca: str | None = Query(default=None),
    categoria: list[str] | None = Query(default=None),
    preco_min: float | None = Query(default=None, ge=0),
    preco_max: float | None = Query(default=None, ge=0),
    nota_min: float | None = Query(default=None, ge=0, le=5),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Lista produtos com paginacao, filtros e metricas agregadas.
    Combina CTE e subqueries para media de avaliacao e vendas.
    """
    products_cte = _group_products_base()
    review_avg_subq = _subquery_grouped_review_average()
    sales_subq = _subquery_grouped_total_sales()

    filters = dict(search=busca, category=categoria, min_price=preco_min, max_price=preco_max)

    base_query = (
        select(
            products_cte.c.id_produto,
            products_cte.c.nome_produto,
            products_cte.c.categoria_produto,
            products_cte.c.descricao_produto,
            products_cte.c.preco_base,
            review_avg_subq.c.media_avaliacoes,
            func.coalesce(sales_subq.c.total_vendas, 0).label("total_vendas"),
            products_cte.c.quantidade_registros,
        )
        .select_from(products_cte)
        .outerjoin(
            review_avg_subq,
            (review_avg_subq.c.nome_produto == products_cte.c.nome_produto)
            & (review_avg_subq.c.categoria_produto == products_cte.c.categoria_produto),
        )
        .outerjoin(
            sales_subq,
            (sales_subq.c.nome_produto == products_cte.c.nome_produto)
            & (sales_subq.c.categoria_produto == products_cte.c.categoria_produto),
        )
    )

    base_query = _apply_product_filters(base_query, products_cte.c, **filters)

    if nota_min is not None:
        base_query = base_query.where(review_avg_subq.c.media_avaliacoes >= nota_min)
        total = db.scalar(select(func.count()).select_from(base_query.subquery()))
    else:
        total = db.scalar(
            _apply_product_filters(
                select(func.count()).select_from(products_cte), products_cte.c, **filters
            )
        )

    rows = db.execute(
        base_query
        .order_by(products_cte.c.nome_produto, products_cte.c.categoria_produto)
        .offset(skip)
        .limit(limit)
    ).all()

    items = [
        ProductListItem(
            id_produto=row.id_produto,
            nome_produto=row.nome_produto,
            categoria_produto=row.categoria_produto,
            descricao_produto=row.descricao_produto,
            preco_base=row.preco_base,
            media_avaliacoes=_round_2(float(row.media_avaliacoes)) if row.media_avaliacoes is not None else None,
            total_vendas=row.total_vendas,
            quantidade_registros=row.quantidade_registros,
        )
        for row in rows
    ]

    return ProductListResponse(total=total or 0, itens=items)


@router.get("/categorias")
def list_categories(db: Session = Depends(get_db)):
    """
    Retorna categorias unicas ordenadas do catalogo.
    Filtra valores nulos e strings vazias.
    """
    category_col = func.trim(Product.product_category)
    rows = db.execute(
        select(category_col.label("categoria_produto"))
        .distinct()
        .where(category_col.is_not(None))
        .where(category_col != "")
        .order_by(category_col)
    ).all()
    return [row.categoria_produto for row in rows]


def _repo_data_dir() -> Path:
    """
    Resolve o diretorio base do repositorio para arquivos auxiliares.
    Usado para localizar CSVs de imagens por categoria.
    """
    return Path(__file__).resolve().parents[3] / "data_ingestao"


@lru_cache(maxsize=1)
def _category_images() -> dict[str, str]:
    """
    Carrega o mapeamento categoria -> imagem a partir do CSV.
    Aplica aliases para categorias com nomes alternativos.
    """
    csv_path = _repo_data_dir() / "dim_categoria_imagens.csv"
    if not csv_path.exists():
        return {}

    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        mapping: dict[str, str] = {}
        for row in reader:
            category = (row.get("Categoria") or row.get("categoria") or "").strip()
            link = (row.get("Link") or row.get("link") or "").strip()
            if category and link:
                mapping[category] = link

        aliases = {
            "casa_conforto_2": "casa_conforto",
            "construcao_ferramentas_construcao": "construcao_ferramentas",
            "construcao_ferramentas_ferramentas": "construcao_ferramentas",
            "construcao_ferramentas_iluminacao": "construcao_iluminacao",
            "construcao_ferramentas_jardim": "ferramentas_jardim",
            "construcao_ferramentas_seguranca": "construcao_seguranca",
            "moveis_cozinha_area_de_servico_jantar_e_jardim": "moveis_cozinha_jantar_jardim",
            "portateis_cozinha_e_preparadores_de_alimentos": "portateis_cozinha",
        }

        for alias, target in aliases.items():
            if target in mapping and alias not in mapping:
                mapping[alias] = mapping[target]

        return mapping


@router.get("/categorias-imagens")
def list_category_images():
    """
    Retorna o dicionario de imagens usadas no frontend.
    Os dados sao cacheados para evitar leituras repetidas.
    A logica de imagens fica separada para permitir cache via lru_cache.
    Isso foi feito por boas praticas do fastapi mesmo que nao seja necessario para o volume atual de dados.
    """
    return _category_images()


@router.get("/{id_produto}", response_model=ProductDetailResponse)
def get_product_detail(
    id_produto: str = PathParam(..., pattern=ID_PATTERN),
    db: Session = Depends(get_db),
):
    """
    Retorna detalhes de um produto agregado por nome e categoria.
    Inclui historico de vendas, avaliacoes e medidas medias.
    """
    product = _get_product_or_404(product_id=id_produto, db=db)

    group = _product_group_by_id(product_id=id_produto, db=db)
    if not group:
        raise HTTPException(status_code=404, detail="Produto nao encontrado")

    group_name, group_category = group.nome_produto, group.categoria_produto
    group_filter = (
        _normalized_name(Product.product_name) == group_name,
        Product.product_category == group_category,
    )

    history_rows = db.execute(
        select(
            Order.order_id.label("id_pedido"),
            Order.purchase_timestamp.label("pedido_compra_timestamp"),
            Order.status,
            func.count(OrderItem.item_id).label("quantidade_itens"),
            func.sum(OrderItem.price_brl + OrderItem.freight_price).label("valor_total"),
        )
        .select_from(OrderItem)
        .join(Product, Product.product_id == OrderItem.product_id)
        .join(Order, Order.order_id == OrderItem.order_id)
        .where(*group_filter)
        .group_by(Order.order_id, Order.purchase_timestamp, Order.status)
        .order_by(Order.purchase_timestamp.desc())
    ).all()

    review_rows = db.execute(
        select(
            OrderReview.review_id.label("id_avaliacao"),
            OrderReview.rating.label("avaliacao"),
            OrderReview.comment_title.label("titulo_comentario"),
            OrderReview.comment.label("comentario"),
            OrderReview.comment_date.label("data_comentario"),
        )
        .select_from(OrderItem)
        .join(Product, Product.product_id == OrderItem.product_id)
        .join(Order, Order.order_id == OrderItem.order_id)
        .join(OrderReview, OrderReview.order_id == Order.order_id)
        .where(*group_filter)
        .order_by(OrderReview.comment_date.desc())
    ).all()

    measure_rows = db.execute(
        select(
            func.avg(Product.product_weight_grams).label("peso_produto_gramas"),
            func.avg(Product.length_cm).label("comprimento_centimetros"),
            func.avg(Product.height_cm).label("altura_centimetros"),
            func.avg(Product.width_cm).label("largura_centimetros"),
            func.avg(Product.base_price).label("preco_base"),
            func.max(Product.product_description).label("descricao_produto"),
        )
        .select_from(Product)
        .where(*group_filter)
    ).first()

    def _measure(field: str, fallback_field: str):
        """
        Calcula media de uma medida quando houver dados agregados.
        Usa o valor individual do produto como fallback.
        """
        value = getattr(measure_rows, field, None) if measure_rows else None
        fallback_value = getattr(product, fallback_field, None)
        return _round_2(float(value) if value is not None else fallback_value)

    review_average = (
        sum(row.avaliacao for row in review_rows) / len(review_rows)
        if review_rows else None
    )

    return ProductDetailResponse(
        id_produto=product.product_id,
        nome_produto=group_name,
        categoria_produto=group_category,
        descricao_produto=measure_rows.descricao_produto if measure_rows else product.product_description,
        preco_base=_measure("preco_base", "base_price"),
        medidas={
            "peso_produto_gramas": _measure("peso_produto_gramas", "product_weight_grams"),
            "comprimento_centimetros": _measure("comprimento_centimetros", "length_cm"),
            "altura_centimetros": _measure("altura_centimetros", "height_cm"),
            "largura_centimetros": _measure("largura_centimetros", "width_cm"),
        },
        media_avaliacoes=_round_2(review_average),
        total_vendas=len(history_rows),
        vendas_historico=[
            OrderHistoryItem(
                id_pedido=row.id_pedido,
                data_pedido=row.pedido_compra_timestamp,
                quantidade_itens=row.quantidade_itens,
                valor_total=float(row.valor_total or 0),
                status=row.status,
            )
            for row in history_rows
        ],
        avaliacoes=[
            ReviewItem(
                id_avaliacao=row.id_avaliacao,
                nota=row.avaliacao,
                titulo=row.titulo_comentario,
                comentario=row.comentario,
                data_comentario=row.data_comentario,
            )
            for row in review_rows
        ],
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ProductListItem)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    """
    Cria um novo produto a partir do payload validado.
    Retorna o item resumido para atualizar o catalogo.
    """
    product_data = _payload_to_model_fields(payload.model_dump())
    product = Product(product_id=uuid4().hex, **product_data)
    db.add(product)
    db.commit()
    db.refresh(product)
    return _product_to_list_item(product)


@router.put("/{id_produto}", response_model=ProductListItem)
def update_product(
    id_produto: str = PathParam(..., pattern=ID_PATTERN),
    payload: ProductUpdate = ...,
    db: Session = Depends(get_db),
):
    """
    Atualiza campos permitidos de um produto existente.
    Rejeita requisicoes sem dados para atualizar.
    """
    product = _get_product_or_404(product_id=id_produto, db=db)

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")

    model_update_data = _payload_to_model_fields(update_data)

    for field, value in model_update_data.items():
        setattr(product, field, value)

    db.add(product)
    db.commit()
    db.refresh(product)
    return _product_to_list_item(product)


@router.delete("/{id_produto}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    id_produto: str = PathParam(..., pattern=ID_PATTERN),
    db: Session = Depends(get_db),
):
    """
    Remove um produto se nao houver historico de vendas.
    Bloqueia a exclusao quando ha itens associados.
    """
    product = _get_product_or_404(product_id=id_produto, db=db)

    has_items = db.scalar(
        select(func.count())
        .select_from(OrderItem)
        .where(OrderItem.product_id == id_produto)
    )

    if has_items:
        raise HTTPException(
            status_code=409,
            detail="Produto possui historico de vendas e nao pode ser removido",
        )

    db.delete(product)
    db.commit()