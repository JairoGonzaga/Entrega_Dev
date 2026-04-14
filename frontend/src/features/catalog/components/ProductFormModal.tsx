import type { FormEvent } from 'react'
import type { ProductFormData } from '../types'

type ProductFormModalProps = {
  isOpen: boolean
  editingId: string | null
  formData: ProductFormData
  allCategories: string[]
  showCategorySuggestions: boolean
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onFieldChange: (field: keyof ProductFormData, value: ProductFormData[keyof ProductFormData]) => void
  onCategorySuggestionSelect: (value: string) => void
  onCategoryFocus: () => void
  onCategoryBlur: () => void
}

export function ProductFormModal({
  isOpen,
  editingId,
  formData,
  allCategories,
  showCategorySuggestions,
  isSubmitting,
  onClose,
  onSubmit,
  onFieldChange,
  onCategorySuggestionSelect,
  onCategoryFocus,
  onCategoryBlur,
}: ProductFormModalProps) {
  if (!isOpen) {
    return null
  }

  return (
    <section className="modal-backdrop" onClick={onClose}>
      <form className="product-form" onSubmit={onSubmit} onClick={(event) => event.stopPropagation()}>
        <h3>{editingId ? 'Editar produto' : 'Novo produto'}</h3>

        <label>
          Nome
          <input
            type="text"
            required
            value={formData.nome_produto}
            onChange={(event) => onFieldChange('nome_produto', event.target.value)}
          />
        </label>

        <label>
          Categoria
          <input
            type="text"
            required
            value={formData.categoria_produto}
            onChange={(event) => onFieldChange('categoria_produto', event.target.value)}
            onFocus={onCategoryFocus}
            onBlur={onCategoryBlur}
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
                    onMouseDown={() => onCategorySuggestionSelect(currentCategory)}
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
            onChange={(event) => onFieldChange('descricao_produto', event.target.value)}
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
              onChange={(event) =>
                onFieldChange('preco_base', event.target.value === '' ? null : Number(event.target.value))
              }
            />
          </label>
          <label>
            Peso (g)
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.peso_produto_gramas ?? ''}
              onChange={(event) =>
                onFieldChange('peso_produto_gramas', event.target.value === '' ? null : Number(event.target.value))
              }
            />
          </label>
          <label>
            Comprimento (cm)
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.comprimento_centimetros ?? ''}
              onChange={(event) =>
                onFieldChange('comprimento_centimetros', event.target.value === '' ? null : Number(event.target.value))
              }
            />
          </label>
          <label>
            Altura (cm)
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.altura_centimetros ?? ''}
              onChange={(event) =>
                onFieldChange('altura_centimetros', event.target.value === '' ? null : Number(event.target.value))
              }
            />
          </label>
          <label>
            Largura (cm)
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.largura_centimetros ?? ''}
              onChange={(event) =>
                onFieldChange('largura_centimetros', event.target.value === '' ? null : Number(event.target.value))
              }
            />
          </label>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </section>
  )
}