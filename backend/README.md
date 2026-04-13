# Backend - Sistema de Compras Online

API REST em FastAPI para gerenciamento de catalogo de produtos com metricas de vendas e avaliacoes.

## Tecnologias

- Python 3.11+
- FastAPI
- SQLAlchemy
- Alembic
- SQLite
- Pytest

## Estrutura principal

```
backend/
|- app/
|  |- main.py                  # Inicializacao da API, CORS e startup
|  |- config.py                # Configuracoes e variaveis de ambiente
|  |- database.py              # Engine, SessionLocal e Base
|  |- data_ingestion.py        # Carga de dados via CSV
|  |- models/                  # Models SQLAlchemy
|  |- schemas/                 # Schemas Pydantic
|  |- routers/
|     |- produtos.py           # Endpoints de produtos
|- alembic/
|  |- versions/                # Migracoes
|- tests/
|  |- test_api.py
|  |- test_data_ingestion.py
|- scripts/
|  |- contar_categorias.py
|- requirements.txt
|- pytest.ini
|- alembic.ini
```

## Setup rapido

1. Criar ambiente virtual e ativar:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Instalar dependencias:

```powershell
pip install -r requirements.txt
```

3. Rodar API:

```powershell
python -m app.main
```

Acessos:
- API: http://localhost:8000
- Docs Swagger: http://localhost:8000/docs

## Banco e migracoes

Aplicar todas as migracoes:

```powershell
alembic upgrade head
```

Ver migration atual:

```powershell
alembic current
```

Criar nova migration:

```powershell
alembic revision -m "descricao da mudanca"
```

## Ingestao de dados

A carga inicial usa os CSVs da pasta data_ingestao na raiz do repositorio.

Comportamento atual:
- ao iniciar a API, tabelas sao criadas se nao existirem
- a ingestao roda automaticamente
- se as tabelas ja estiverem populadas, a ingestao nao duplica dados

## Endpoints implementados

Prefixo base: /api

- GET /produtos
  - filtros: busca, categoria, preco_min, preco_max, nota_min
  - paginacao: skip e limit
- GET /produtos/categorias
- GET /produtos/categorias-imagens
- GET /produtos/{id_produto}
- POST /produtos
- PUT /produtos/{id_produto}
- DELETE /produtos/{id_produto}

Healthcheck:
- GET /

## Testes

Rodar toda a suite:

```powershell
pytest -v
```

Cobertura:

```powershell
pytest --cov=app --cov-report=term-missing
```

Escopo de testes atual:
- healthcheck
- listagem e filtros de produtos
- detalhe com historico e avaliacoes
- CRUD de produtos
- caminhos de validacao e not found
- ingestao de dados e funcoes auxiliares
