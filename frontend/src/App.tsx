/* Painel principal do catalogo: filtros, detalhes, CRUD e chamadas da API. */
import './App.css'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

type ProductListItem = {
  id_produto: string
  nome_produto: string
  categoria_produto: string
  descricao_produto: string | null
  preco_base: number | null
  media_avaliacoes: number | null
  total_vendas: number
  quantidade_registros: number
}

type ProductListResponse = {
  total: number
  itens: ProductListItem[]
}

type CategoryImageMap = Record<string, string>

type OrderHistoryItem = {
  id_pedido: string
  data_pedido: string | null
  quantidade_itens: number
  valor_total: number
  status: string
}

type ReviewItem = {
  id_avaliacao: string
  nota: number
  titulo: string | null
  comentario: string | null
  data_comentario: string | null
}

type ProductDetail = {
  id_produto: string
  nome_produto: string
  categoria_produto: string
  descricao_produto: string | null
  preco_base: number | null
  medidas: {
    peso_produto_gramas: number | null
    comprimento_centimetros: number | null
    altura_centimetros: number | null
    largura_centimetros: number | null
  }
  media_avaliacoes: number | null
  total_vendas: number
  vendas_historico: OrderHistoryItem[]
  avaliacoes: ReviewItem[]
}

type ProductFormData = {
  nome_produto: string
  categoria_produto: string
  descricao_produto: string | null
  preco_base: number | null
  peso_produto_gramas: number | null
  comprimento_centimetros: number | null
  altura_centimetros: number | null
  largura_centimetros: number | null
}

const API_URL_BASE = import.meta.env.VITE_API_BASE_URL
const API_CANDIDATES = Array.from(
  new Set(
    [
      API_URL_BASE,
      '/api',
      'http://127.0.0.1:8000/api',
      'http://localhost:8000/api',
    ].filter((value): value is string => Boolean(value?.trim())),
  ),
)
const PAGE_SIZE = 10

const emptyForm: ProductFormData = {
  nome_produto: '',
  categoria_produto: '',
  descricao_produto: null,
  preco_base: null,
  peso_produto_gramas: null,
  comprimento_centimetros: null,
  altura_centimetros: null,
  largura_centimetros: null,
}

async function fetchJson<T>(path: string): Promise<T> {
  /*
   * Faz requisicao e retorna JSON tipado.
   * Dispara erro quando a API responde com falha.
   */
  const response = await fetchWithFallback(path)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.detail ?? 'Falha na requisicao')
  }

  return response.json() as Promise<T>
}

async function readJsonResponse(response: Response) {
  /*
   * Le o corpo da resposta com seguranca.
   * Retorna null quando nao ha conteudo ou JSON invalido.
   */
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function fetchCategories() {
  /*
   * Busca lista de categorias na API.
   * Valida o formato para evitar estado inconsistente.
   */
  const response = await fetchWithFallback('/produtos/categorias')
  const data = await readJsonResponse(response)

  if (!response.ok) {
    const detail = typeof data === 'object' && data ? (data as { detail?: string }).detail : undefined
    throw new Error(detail ?? `Erro ${response.status} ao carregar categorias`)
  }

  if (!Array.isArray(data)) {
    throw new Error('Resposta invalida de categorias')
  }

  return data as string[]
}

async function fetchCategoryImages() {
  /*
   * Busca mapeamento categoria -> imagem.
   * Garante que o retorno seja um objeto simples.
   */
  const response = await fetchWithFallback('/produtos/categorias-imagens')
  const data = await readJsonResponse(response)

  if (!response.ok) {
    const detail = typeof data === 'object' && data ? (data as { detail?: string }).detail : undefined
    throw new Error(detail ?? `Erro ${response.status} ao carregar imagens`) 
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Resposta invalida de imagens')
  }

  return data as CategoryImageMap
}

function toNumberOrNull(value: string) {
  /*
   * Converte input de texto em numero ou null.
   * Evita NaN propagando valores vazios.
   */
  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  const converted = Number(normalized)
  return Number.isNaN(converted) ? null : converted
}

function normalizeBase(base: string) {
  /*
   * Remove barra final de URLs base.
   * Mantem consistencia ao montar endpoints.
   */
  return base.endsWith('/') ? base.slice(0, -1) : base
}

async function fetchWithFallback(path: string, init?: RequestInit) {
  /*
   * Tenta varios endpoints ate encontrar um valido.
   * Retorna a ultima resposta/erro se nenhum funcionar.
   */
  let lastResponse: Response | null = null
  let lastError: Error | null = null

  for (const base of API_CANDIDATES) {
    try {
      const response = await fetch(`${normalizeBase(base)}${path}`, init)
      if (response.ok) {
        return response
      }

      lastResponse = response
    } catch (error) {
      if (error instanceof Error) {
        lastError = error
      }
    }
  }

  if (lastResponse) {
    return lastResponse
  }

  if (lastError) {
    throw lastError
  }

  throw new Error('Nao foi possivel conectar na API')
}

function CatalogPanel() {
  /*
   * Componente principal do painel do catalogo.
   * Orquestra filtros, detalhes, CRUD e chamadas da API.
   */
  const [items, setItems] = useState<ProductListItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [minRating, setMinRating] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [debouncedCategories, setDebouncedCategories] = useState<string[]>([])
  const [debouncedMinRating, setDebouncedMinRating] = useState('')
  const [page, setPage] = useState(1)
  const [allCategories, setAllCategories] = useState<string[]>([])
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [categoryImages, setCategoryImages] = useState<CategoryImageMap>({})
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ProductDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ProductFormData>(emptyForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  async function loadProducts(currentPage = page) {
    /*
     * Carrega a listagem com filtros e paginacao.
     * Atualiza estado de itens, total e categorias.
     */
    setIsLoading(true)
    setError(null)

    const params = new URLSearchParams({
      skip: String((currentPage - 1) * PAGE_SIZE),
      limit: String(PAGE_SIZE),
    })

    if (debouncedSearch.trim()) {
      params.set('busca', debouncedSearch.trim())
    }
    if (debouncedCategories.length > 0) {
      debouncedCategories.forEach((category) => {
        if (category.trim()) {
          params.append('categoria', category.trim())
        }
      })
    }
    if (debouncedMinRating.trim()) {
      params.set('nota_min', debouncedMinRating.trim())
    }

    try {
      const data = await fetchJson<ProductListResponse>(`/produtos?${params.toString()}`)
      setItems(data.itens)
      setTotal(data.total)

      if (allCategories.length === 0) {
        try {
          const categories = await fetchCategories()
          console.info('categorias:total', categories.length)
          setAllCategories(categories)
          setCategoriesError(null)
        } catch (err) {
          setCategoriesError(err instanceof Error ? err.message : 'Erro ao carregar categorias')
          const fallback = Array.from(
            new Set(data.itens.map((item) => item.categoria_produto).filter(Boolean)),
          ).sort()
          if (fallback.length > 0) {
            setAllCategories(fallback)
          }
        }
      }

      if (data.itens.length === 0) {
        setSelectedId(null)
        setDetail(null)
        return
      }

      const hasSelected = selectedId
        ? data.itens.some((item) => item.id_produto === selectedId)
        : false

      if (!hasSelected) {
        setSelectedId(data.itens[0].id_produto)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadDetail(productId: string) {
    /*
     * Carrega detalhes do produto selecionado.
     * Inclui historico de vendas e avaliacoes.
     */
    setIsDetailLoading(true)
    setError(null)
    try {
      const data = await fetchJson<ProductDetail>(`/produtos/${productId}`)
      setDetail(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar detalhes')
      setDetail(null)
    } finally {
      setIsDetailLoading(false)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search)
      setDebouncedCategories(selectedCategories)
      setDebouncedMinRating(minRating)
    }, 300)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [search, selectedCategories, minRating])

  useEffect(() => {
    void loadProducts(1)
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, debouncedCategories, debouncedMinRating])


  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await fetchCategories()
        console.info('categorias:total', data.length)
        setAllCategories(data)
        setCategoriesError(null)
      } catch (err) {
        setCategoriesError(err instanceof Error ? err.message : 'Erro ao carregar categorias')
      }
    }

    void loadCategories()
  }, [])

  useEffect(() => {
    async function loadCategoryImages() {
      try {
        const data = await fetchCategoryImages()
        setCategoryImages(data)
      } catch (err) {
        console.info('categorias:imagens', err)
      }
    }

    void loadCategoryImages()
  }, [])

  useEffect(() => {
    if (!selectedId) {
      return
    }
    void loadDetail(selectedId)
  }, [selectedId])

  function openCreateForm() {
    /*
     * Abre o formulario de criacao com valores vazios.
     * Reseta estado de edicao e sugestoes.
     */
    setEditingId(null)
    setFormData(emptyForm)
    setShowCategorySuggestions(false)
    setIsFormOpen(true)
  }

  function openEditForm(item: ProductListItem) {
    /*
     * Abre o formulario de edicao com dados do item.
     * Usa medidas do detalhe quando disponiveis.
     */
    setEditingId(item.id_produto)
    setFormData({
      nome_produto: item.nome_produto,
      categoria_produto: item.categoria_produto,
      descricao_produto: item.descricao_produto,
      preco_base: item.preco_base,
      peso_produto_gramas: detail?.medidas.peso_produto_gramas ?? null,
      comprimento_centimetros: detail?.medidas.comprimento_centimetros ?? null,
      altura_centimetros: detail?.medidas.altura_centimetros ?? null,
      largura_centimetros: detail?.medidas.largura_centimetros ?? null,
    })
    setShowCategorySuggestions(false)
    setIsFormOpen(true)
  }

  function selectCategorySuggestion(value: string) {
    /*
     * Aplica a sugestao de categoria ao formulario.
     * Fecha o painel de sugestoes.
     */
    setFormData((prev) => ({ ...prev, categoria_produto: value }))
    setShowCategorySuggestions(false)
  }

  function toggleCategory(value: string) {
    setSelectedCategories((prev) =>
      prev.includes(value)
        ? prev.filter((current) => current !== value)
        : [...prev, value],
    )
  }

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    /*
     * Envia criacao/edicao para a API.
     * Recarrega a lista ao concluir com sucesso.
     */
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const payload: ProductFormData = {
      nome_produto: formData.nome_produto.trim(),
      categoria_produto: formData.categoria_produto.trim(),
      descricao_produto: formData.descricao_produto?.trim() || null,
      preco_base: formData.preco_base,
      peso_produto_gramas: formData.peso_produto_gramas,
      comprimento_centimetros: formData.comprimento_centimetros,
      altura_centimetros: formData.altura_centimetros,
      largura_centimetros: formData.largura_centimetros,
    }

    try {
      const isEditing = Boolean(editingId)

      const response = await fetchWithFallback(isEditing ? `/produtos/${editingId}` : '/produtos', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        const detailMessage = body?.detail ?? 'Nao foi possivel salvar o produto'
        throw new Error(detailMessage)
      }

      setIsFormOpen(false)
      await loadProducts(page)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar produto')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteProduct(id: string) {
    /*
     * Remove produto via API apos confirmacao.
     * Recarrega a listagem para refletir a exclusao.
     */
    const confirmed = window.confirm('Deseja remover este produto?')
    if (!confirmed) {
      return
    }

    setError(null)
    try {
      const response = await fetchWithFallback(`/produtos/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.detail ?? 'Nao foi possivel remover o produto')
      }

      if (selectedId === id) {
        setSelectedId(null)
      }

      await loadProducts(page)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover produto')
    }
  }

  function formatCurrency(value: number | null) {
    /*
     * Formata valores monetarios no padrao pt-BR.
     * Retorna "-" quando o valor e ausente.
     */
    if (value == null) {
      return '-'
    }

    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  function formatDate(value: string | null) {
    /*
     * Converte datas ISO para exibicao pt-BR.
     * Retorna "-" quando o valor e vazio.
     */
    if (!value) {
      return '-'
    }

    return new Date(value).toLocaleDateString('pt-BR')
  }

  function categoryInitials(value: string) {
    /*
     * Gera iniciais de categoria para o placeholder.
     * Usa ate duas partes separadas por underscore.
     */
    return value
      .split('_')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('')
  }

  return (
    <main className="dashboard">
      <header className="hero-panel">
        <div>
          <p className="eyebrow">Painel do gerente</p>
          <h1>Gestao de catalogo e desempenho</h1>
          <p className="subhead">
            Controle produtos, avaliacoes e historico de vendas em um unico lugar.
          </p>
        </div>
        <button className="primary" onClick={openCreateForm}>
          Novo produto
        </button>
      </header>

      <section className="filters">
        <input
          type="text"
          placeholder="Buscar por nome, categoria ou descricao"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="multi-select">
          <button
            type="button"
            className={`toggle ${isCategoryOpen ? 'active' : ''}`}
            onClick={() => setIsCategoryOpen((prev) => !prev)}
            aria-expanded={isCategoryOpen}
            aria-controls="category-panel"
          >
            Categorias
            <span className="toggle-count">
              {selectedCategories.length > 0 ? selectedCategories.length : 'Todas'}
            </span>
          </button>

          {isCategoryOpen && (
            <div className="multi-select-panel" id="category-panel">
              <div className="category-options" role="listbox" aria-multiselectable="true">
                {allCategories.map((currentCategory) => {
                  const isActive = selectedCategories.includes(currentCategory)
                  return (
                    <button
                      key={currentCategory}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={`category-option ${isActive ? 'active' : ''}`}
                      onClick={() => toggleCategory(currentCategory)}
                    >
                      {currentCategory}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <input
          type="number"
          min="0"
          max="5"
          step="0.1"
          placeholder="Nota minima"
          value={minRating}
          onChange={(event) => setMinRating(event.target.value)}
        />

      </section>

      <section className="category-chips" aria-label="Categorias selecionadas">
        {selectedCategories.length > 0 ? (
          selectedCategories.map((category) => (
            <button
              key={category}
              type="button"
              className="chip active"
              onClick={() => toggleCategory(category)}
            >
              {category}
            </button>
          ))
        ) : (
          <p className="chip-empty">Nenhuma categoria selecionada.</p>
        )}
      </section>

      {error && <p className="error">{error}</p>}
      {categoriesError && <p className="error">{categoriesError}</p>}

      <section className="content-grid">
        <article className="catalog-card">
          <div className="section-head">
            <h2>Catalogo</h2>
            <span>{total} registros</span>
          </div>

          {isLoading ? (
            <p>Carregando produtos...</p>
          ) : items.length === 0 ? (
            <p>Nenhum produto encontrado para os filtros selecionados.</p>
          ) : (
            <ul className="product-list">
              {items.map((item) => (
                <li
                  key={item.id_produto}
                  className={item.id_produto === selectedId ? 'active' : ''}
                  onClick={() => setSelectedId(item.id_produto)}
                >
                  <div className="product-card">
                    <div className="product-thumb">
                      {categoryImages[item.categoria_produto] ? (
                        <img
                          src={categoryImages[item.categoria_produto]}
                          alt={item.categoria_produto}
                          loading="lazy"
                        />
                      ) : (
                        <span>{categoryInitials(item.categoria_produto)}</span>
                      )}
                    </div>
                    <div className="product-main">
                      <div className="product-title-row">
                        <h3>{item.nome_produto}</h3>
                        {item.quantidade_registros > 1 && (
                          <span className="summary-badge">{item.quantidade_registros} registros</span>
                        )}
                      </div>
                      <p>{item.categoria_produto}</p>
                      <div className="metrics">
                        <span>{formatCurrency(item.preco_base)}</span>
                        <span>
                          {item.media_avaliacoes != null ? `${item.media_avaliacoes.toFixed(1)} / 5` : 'Sem nota'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="actions">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedId(item.id_produto)
                        openEditForm(item)
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleDeleteProduct(item.id_produto)
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <footer className="pagination">
            <button
              type="button"
              onClick={() => {
                const nextPage = Math.max(1, page - 1)
                setPage(nextPage)
                void loadProducts(nextPage)
              }}
              disabled={page <= 1}
            >
              Anterior
            </button>
            <span>
              Pagina {page} de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => {
                const nextPage = Math.min(totalPages, page + 1)
                setPage(nextPage)
                void loadProducts(nextPage)
              }}
              disabled={page >= totalPages}
            >
              Proxima
            </button>
          </footer>
        </article>

        <article className="details-card">
          <div className="section-head">
            <h2>Detalhes</h2>
          </div>

          {isDetailLoading ? (
            <p>Carregando detalhes...</p>
          ) : !detail ? (
            <p>Selecione um produto para ver as informacoes completas.</p>
          ) : (
            <>
              <div className="summary-row">
                <div className="detail-hero">
                  <div className="detail-thumb">
                    {categoryImages[detail.categoria_produto] ? (
                      <img
                        src={categoryImages[detail.categoria_produto]}
                        alt={detail.categoria_produto}
                        loading="lazy"
                      />
                    ) : (
                      <span>{categoryInitials(detail.categoria_produto)}</span>
                    )}
                  </div>
                  <div>
                    <h3>{detail.nome_produto}</h3>
                    <p>{detail.categoria_produto}</p>
                    <p>{detail.descricao_produto || 'Sem descricao cadastrada'}</p>
                  </div>
                </div>
              </div>

              <div className="stat-grid">
                <div>
                  <span>Preco base</span>
                  <strong>{formatCurrency(detail.preco_base)}</strong>
                </div>
                <div>
                  <span>Media de avaliacoes</span>
                  <strong>
                    {detail.media_avaliacoes != null ? `${detail.media_avaliacoes.toFixed(2)} / 5` : 'Sem nota'}
                  </strong>
                </div>
                <div>
                  <span>Total de vendas</span>
                  <strong>{detail.total_vendas}</strong>
                </div>
              </div>

              <div className="measures">
                <h4>Medidas tecnicas</h4>
                <p>Peso: {detail.medidas.peso_produto_gramas ?? '-'} g</p>
                <p>Comprimento: {detail.medidas.comprimento_centimetros ?? '-'} cm</p>
                <p>Altura: {detail.medidas.altura_centimetros ?? '-'} cm</p>
                <p>Largura: {detail.medidas.largura_centimetros ?? '-'} cm</p>
              </div>

              <div className="tables">
                <section>
                  <h4>Historico de vendas</h4>
                  {detail.vendas_historico.length === 0 ? (
                    <p>Sem vendas registradas.</p>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Pedido</th>
                          <th>Data</th>
                          <th>Itens</th>
                          <th>Total</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.vendas_historico.map((venda) => (
                          <tr key={venda.id_pedido}>
                            <td>{venda.id_pedido}</td>
                            <td>{formatDate(venda.data_pedido)}</td>
                            <td>{venda.quantidade_itens}</td>
                            <td>{formatCurrency(venda.valor_total)}</td>
                            <td>{venda.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>

                <section>
                  <h4>Avaliacoes</h4>
                  {detail.avaliacoes.length === 0 ? (
                    <p>Sem avaliacoes registradas.</p>
                  ) : (
                    <ul className="reviews">
                      {detail.avaliacoes.map((avaliacao) => (
                        <li key={avaliacao.id_avaliacao}>
                          <strong>{avaliacao.nota} / 5</strong>
                          <p>{avaliacao.titulo || 'Sem titulo'}</p>
                          <small>{avaliacao.comentario || 'Sem comentario'}</small>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </>
          )}
        </article>
      </section>

      {isFormOpen && (
        <section className="modal-backdrop" onClick={() => setIsFormOpen(false)}>
          <form className="product-form" onSubmit={handleFormSubmit} onClick={(event) => event.stopPropagation()}>
            <h3>{editingId ? 'Editar produto' : 'Novo produto'}</h3>

            <label>
              Nome
              <input
                type="text"
                required
                value={formData.nome_produto}
                onChange={(event) => setFormData((prev) => ({ ...prev, nome_produto: event.target.value }))}
              />
            </label>

            <label>
              Categoria
              <input
                type="text"
                required
                value={formData.categoria_produto}
                onChange={(event) => {
                  const value = event.target.value
                  setFormData((prev) => ({ ...prev, categoria_produto: value }))
                  setShowCategorySuggestions(Boolean(value.trim()))
                }}
                onFocus={() => setShowCategorySuggestions(Boolean(formData.categoria_produto.trim()))}
                onBlur={() => window.setTimeout(() => setShowCategorySuggestions(false), 120)}
              />
              {showCategorySuggestions && (
                <div className="category-suggestions" role="listbox">
                  {allCategories
                    .filter((currentCategory) =>
                      currentCategory.toLowerCase().includes(formData.categoria_produto.toLowerCase()),
                    )
                    .slice(0, 8)
                    .map((currentCategory) => (
                      <button
                        type="button"
                        key={currentCategory}
                        className="category-suggestion"
                        onMouseDown={() => selectCategorySuggestion(currentCategory)}
                      >
                        {currentCategory}
                      </button>
                    ))}
                </div>
              )}
            </label>

            <label>
              Descricao
              <textarea
                rows={3}
                value={formData.descricao_produto ?? ''}
                onChange={(event) => setFormData((prev) => ({ ...prev, descricao_produto: event.target.value }))}
              />
            </label>

            <div className="row-grid">
              <label>
                Preco base
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.preco_base ?? ''}
                  onChange={(event) => setFormData((prev) => ({ ...prev, preco_base: toNumberOrNull(event.target.value) }))}
                />
              </label>
              <label>
                Peso (g)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.peso_produto_gramas ?? ''}
                  onChange={(event) => setFormData((prev) => ({ ...prev, peso_produto_gramas: toNumberOrNull(event.target.value) }))}
                />
              </label>
              <label>
                Comprimento (cm)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.comprimento_centimetros ?? ''}
                  onChange={(event) => setFormData((prev) => ({ ...prev, comprimento_centimetros: toNumberOrNull(event.target.value) }))}
                />
              </label>
              <label>
                Altura (cm)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.altura_centimetros ?? ''}
                  onChange={(event) => setFormData((prev) => ({ ...prev, altura_centimetros: toNumberOrNull(event.target.value) }))}
                />
              </label>
              <label>
                Largura (cm)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.largura_centimetros ?? ''}
                  onChange={(event) => setFormData((prev) => ({ ...prev, largura_centimetros: toNumberOrNull(event.target.value) }))}
                />
              </label>
            </div>

            <div className="form-actions">
              <button type="button" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </button>
              <button className="primary" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  )
}

export default CatalogPanel
