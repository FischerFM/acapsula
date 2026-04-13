import { useState, useEffect } from 'react';
import api, { downloadFile } from '../api';
import Pagination from '../components/Pagination';

const POR_PAGINA = 20;

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function today() { return new Date().toISOString().split('T')[0]; }
function addDays(n) { return new Date(Date.now() + n * 86400000).toISOString().split('T')[0]; }

export default function Historico() {
  const [movs, setMovs] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ insumo_id: '', tipo: '', inicio: addDays(-30), fim: today() });
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    api.get('/insumos').then(r => setInsumos(r.data));
  }, []);

  function buscar() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filtros.insumo_id) params.set('insumo_id', filtros.insumo_id);
    if (filtros.tipo) params.set('tipo', filtros.tipo);
    if (filtros.inicio) params.set('inicio', filtros.inicio);
    if (filtros.fim) params.set('fim', filtros.fim);
    api.get(`/movimentacoes?${params}`)
      .then(r => setMovs(r.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => { buscar(); }, []);

  function exportar() {
    const params = new URLSearchParams();
    if (filtros.insumo_id) params.set('insumo_id', filtros.insumo_id);
    if (filtros.tipo) params.set('tipo', filtros.tipo);
    if (filtros.inicio) params.set('inicio', filtros.inicio);
    if (filtros.fim) params.set('fim', filtros.fim);
    downloadFile(`/exportar/movimentacoes?${params}`, `historico_${filtros.inicio}_${filtros.fim}.xlsx`);
  }

  const totalEntradas = movs.filter(m => m.tipo === 'Entrada').reduce((s, m) => s + m.quantidade, 0);
  const totalSaidas = movs.filter(m => m.tipo === 'Saída').reduce((s, m) => s + m.quantidade, 0);

  let filtrados = movs;
  if (busca.trim()) filtrados = filtrados.filter(m =>
    m.insumo_nome.toLowerCase().includes(busca.toLowerCase()) ||
    (m.fornecedor || '').toLowerCase().includes(busca.toLowerCase())
  );
  const totalFiltrado = filtrados.length;
  const listaPagina = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <div>
      <div className="page-header">
        <h2>Historico de Movimentacoes</h2>
        <button className="btn btn-ghost" onClick={exportar}>Exportar Excel</button>
      </div>

      {/* Busca por texto */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Buscar por insumo ou fornecedor..."
          value={busca}
          onChange={e => { setBusca(e.target.value); setPagina(1); }}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14, minWidth: 260 }}
        />
        {busca && <button className="btn btn-ghost btn-sm" onClick={() => { setBusca(''); setPagina(1); }}>Limpar</button>}
        <span className="text-muted" style={{ fontSize: 13, marginLeft: 'auto' }}>{totalFiltrado} registro(s)</span>
      </div>

      {/* Filtros */}
      <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 20 }}>
        <select value={filtros.insumo_id} onChange={e => setFiltros(f => ({ ...f, insumo_id: e.target.value }))}>
          <option value="">Todos os insumos</option>
          {insumos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
        </select>
        <select value={filtros.tipo} onChange={e => setFiltros(f => ({ ...f, tipo: e.target.value }))}>
          <option value="">Todos os tipos</option>
          <option value="Entrada">Entrada</option>
          <option value="Saída">Saída</option>
          <option value="Ajuste">Ajuste</option>
        </select>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>De</label>
        <input type="date" value={filtros.inicio} onChange={e => setFiltros(f => ({ ...f, inicio: e.target.value }))}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14 }} />
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Até</label>
        <input type="date" value={filtros.fim} onChange={e => setFiltros(f => ({ ...f, fim: e.target.value }))}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14 }} />
        <button className="btn btn-primary" onClick={buscar} disabled={loading}>
          {loading ? 'Buscando...' : 'Filtrar'}
        </button>
      </div>

      {/* Cards de resumo */}
      {!loading && movs.length > 0 && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-value">{movs.length}</div>
            <div className="stat-label">Movimentacoes</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success, #38a169)' }}>+{Math.round(totalEntradas * 100) / 100}</div>
            <div className="stat-label">Total de Entradas</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--danger, #e53e3e)' }}>−{Math.round(totalSaidas * 100) / 100}</div>
            <div className="stat-label">Total de Saidas</div>
          </div>
        </div>
      )}

      <div className="table-card">
        {loading ? <div className="loading">Carregando...</div> : movs.length === 0 ? (
          <div className="empty-state">Nenhuma movimentação encontrada para o período.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Insumo</th>
                <th>Marca</th>
                <th>Tipo</th>
                <th>Quantidade</th>
                <th>Saldo Apos</th>
                <th>Fornecedor / Origem</th>
              </tr>
            </thead>
            <tbody>
              {listaPagina.map(m => (
                <tr key={m.id}>
                  <td><strong>{formatDate(m.data)}</strong></td>
                  <td>{m.insumo_nome}</td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{m.marca || '—'}</td>
                  <td>
                    <span className={`badge ${m.tipo === 'Entrada' ? 'badge-ok' : m.tipo === 'Ajuste' ? 'badge-confirmado' : 'badge-cancelado'}`}>
                      {m.tipo}
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: m.tipo === 'Saída' ? 'var(--danger, #e53e3e)' : 'var(--success, #38a169)' }}>
                      {m.tipo === 'Saída' ? '−' : '+'}{m.quantidade} <span className="text-muted" style={{ fontWeight: 400, fontSize: 12 }}>{m.unidade_medida}</span>
                    </strong>
                  </td>
                  <td className="text-muted">{m.saldo_apos} {m.unidade_medida}</td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{m.fornecedor || m.observacoes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination pagina={pagina} total={totalFiltrado} porPagina={POR_PAGINA} onChange={p => { setPagina(p); window.scrollTo(0,0); }} />
      </div>
    </div>
  );
}
