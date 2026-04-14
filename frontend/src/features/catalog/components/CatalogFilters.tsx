type CatalogFiltersProps = {
  search: string
  onSearchChange: (value: string) => void
  selectedCategories: string[]
  allCategories: string[]
  isCategoryOpen: boolean
  onToggleCategoryOpen: () => void
  onToggleCategory: (value: string) => void
  minRating: string
  onMinRatingChange: (value: string) => void
}

export function CatalogFilters({
  search,
  onSearchChange,
  selectedCategories,
  allCategories,
  isCategoryOpen,
  onToggleCategoryOpen,
  onToggleCategory,
  minRating,
  onMinRatingChange,
}: CatalogFiltersProps) {
  return (
    <>
      <section className="filters">
        <input
          type="text"
          placeholder="Buscar por nome, categoria ou descricao"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />

        <div className="multi-select">
          <button
            type="button"
            className={`toggle ${isCategoryOpen ? 'active' : ''}`}
            onClick={onToggleCategoryOpen}
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
                      onClick={() => onToggleCategory(currentCategory)}
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
          onChange={(event) => onMinRatingChange(event.target.value)}
        />
      </section>

      <section className="category-chips" aria-label="Categorias selecionadas">
        {selectedCategories.length > 0 ? (
          selectedCategories.map((category) => (
            <button
              key={category}
              type="button"
              className="chip active"
              onClick={() => onToggleCategory(category)}
            >
              {category}
            </button>
          ))
        ) : (
          <p className="chip-empty">Nenhuma categoria selecionada.</p>
        )}
      </section>
    </>
  )
}