import type { CategoryImageMap, ProductDetail } from '../types'

type ProductDetailsPanelProps = {
  detail: ProductDetail | null
  isDetailLoading: boolean
  categoryImages: CategoryImageMap
  formatCurrency: (value: number | null) => string
  formatDate: (value: string | null) => string
  categoryInitials: (value: string) => string
}

export function ProductDetailsPanel({
  detail,
  isDetailLoading,
  categoryImages,
  formatCurrency,
  formatDate,
  categoryInitials,
}: ProductDetailsPanelProps) {
  return (
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
  )
}