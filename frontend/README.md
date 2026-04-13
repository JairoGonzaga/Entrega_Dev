# Frontend - Painel de Catalogo

Aplicacao React + TypeScript + Vite para o modulo de gerenciamento de produtos do e-commerce.

## Funcionalidades implementadas

- listagem de produtos com paginacao
- busca textual
- filtros por categoria e nota minima
- visualizacao de detalhes de produto
- exibicao de historico de vendas e avaliacoes
- criacao, edicao e remocao de produto
- tratamento de falhas de API com mensagens de erro

## Tecnologias

- React 19
- TypeScript
- Vite
- ESLint

## Requisitos

- Node.js 20+
- pnpm

## Rodando localmente

1. Instalar dependencias:

```powershell
pnpm install
```

2. Subir em desenvolvimento:

```powershell
pnpm dev
```

3. Build de producao:

```powershell
pnpm build
```

4. Preview local do build:

```powershell
pnpm preview
```

## Integracao com backend

A aplicacao tenta consumir a API na seguinte ordem:

1. VITE_API_BASE_URL (se definida)
2. /api
3. http://127.0.0.1:8000/api
4. http://localhost:8000/api

Para fixar uma URL, criar arquivo .env na pasta frontend com:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

## Scripts disponiveis

- pnpm dev
- pnpm build
- pnpm lint
- pnpm preview

## Estrutura resumida

```
frontend/
|- src/
|  |- App.tsx         # Painel principal: listagem, filtros, detalhe e CRUD
|  |- App.css         # Estilos do painel
|  |- main.tsx        # Bootstrap da aplicacao
|  |- index.css       # Estilos globais
|- public/
|- package.json
|- vite.config.ts
```
