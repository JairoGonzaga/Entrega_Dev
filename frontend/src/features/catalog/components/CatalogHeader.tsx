type CatalogHeaderProps = {
  onCreate: () => void
}

export function CatalogHeader({ onCreate }: CatalogHeaderProps) {
  return (
    <header className="hero-panel">
      <div>
        <p className="eyebrow">Painel do gerente</p>
        <h1>Gestao de catalogo e desempenho</h1>
        <p className="subhead">
          Controle produtos, avaliacoes e historico de vendas em um unico lugar.
        </p>
      </div>
      <button className="primary" onClick={onCreate}>
        Novo produto
      </button>
    </header>
  )
}