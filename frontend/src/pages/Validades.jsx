import { useState, useEffect } from 'react';
import api from '../api';

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const STATUS_LABEL = { vencido: 'Vencido', vencendo: 'Vencendo', ok: 'OK' };
const STATUS_BADGE = { vencido: 'badge-critico', vencendo: 'badge-atencao', ok: 'badge-ok' };

export default function Validades() {
  const [lotes, setLotes] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroInsumo, setFiltroInsumo] = useState('');
  const [busca, setBusca] = useState('');
  const [dias, setDias] = useState(() => parseInt(localStorage.getItem('validade_dias') || '30'));
  const [diasInput, setDiasInput] = useState(String(parseInt(localStorage.getItem('validade_dias') || '30')));

  function salvarDias(v) {
    const n = parseInt(v);
    if (!n || n < 1) return;
    setDias(n);
    localStorage.setItem('validade_dias', String(n));
  }

  const load = () => {
    setLoading(true);
    api.get('/validades').then(r => setLotes(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get('/insumos').then(r => setInsumos(r.data));
    load();
  }, []);

  // Recalcula status com base no prazo configurado
  const hoje = new Date().toISOString().split('T')[0];
  const limite = new Date(Date.now() + dias * 86400000).toISOString().split('T')[0];
  const lotesMapped = lotes.map(l => ({
    ...l,
    status: l.data_validade < hoje ? 'vencido' : l.data_validade <= limite ? 'vencendo' : 'ok',
  }));

  let filtrados = lotesMapped;
  if (filtroStatus) filtrados = filtrados.filter(l => l.status === filtroStatus);
  if (filtroInsumo) filtrados = filtrados.filter(l => String(l.insumo_id) === filtroInsumo);
  if (busca.trim()) filtrados = filtrados.filter(l =>
    l.insumo_nome.toLowerCase().includes(busca.toLowerCase()) ||
    (l.lote || '').toLowerCase().includes(busca.toLowerCase())
  );

  const totalVencidos = lotesMapped.filter(l => l.status === 'vencido').length;
  const totalVencendo = lotesMapped.filter(l => l.status === 'vencendo').length;

  return (
    <div>
      <div className="page-header">
        <h2>Controle de Validades</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>Alertar com</span>
          <input
            type="number"
            min="1"
            value={diasInput}
            onChange={e => setDiasInput(e.target.value)}
            onBlur={() => salvarDias(diasInput)}
            style={{ width: 60, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, textAlign: 'center' }}
          />
          <span style={{ color: 'var(--text-muted)' }}>dias de antecedência</span>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card danger">
          <div className="stat-value">{totalVencidos}</div>
          <div className="stat-label">Lotes Vencidos</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{totalVencendo}</div>
          <div className="stat-label">Vencendo em {dias} dias</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{lotesMapped.filter(l => l.status === 'ok').length}</div>
          <div className="stat-label">Lotes OK</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{lotesMapped.length}</div>
          <div className="stat-label">Total de Lotes</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Buscar por insumo ou lote..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14, minWidth: 220 }}
        />
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="vencido">Vencidos</option>
          <option value="vencendo">Vencendo</option>
          <option value="ok">OK</option>
        </select>
        <select value={filtroInsumo} onChange={e => setFiltroInsumo(e.target.value)}>
          <option value="">Todos os insumos</option>
          {insumos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
        </select>
        {(busca || filtroStatus || filtroInsumo) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setBusca(''); setFiltroStatus(''); setFiltroInsumo(''); }}>
            Limpar filtros
          </button>
        )}
        <span className="text-muted" style={{ fontSize: 13, marginLeft: 'auto' }}>{filtrados.length} lote(s)</span>
      </div>

      <div className="table-card">
        {loading ? <div className="loading">Carregando...</div> : filtrados.length === 0 ? (
          <div className="empty-state">Nenhum lote com data de validade registrada.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Insumo</th>
                <th>Lote</th>
                <th>Validade</th>
                <th>Quantidade</th>
                <th>Entrada</th>
                <th>Fornecedor</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(l => (
                <tr key={l.id}>
                  <td><span className={`badge ${STATUS_BADGE[l.status]}`}>{STATUS_LABEL[l.status]}</span></td>
                  <td><strong>{l.insumo_nome}</strong></td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{l.lote || '—'}</td>
                  <td>
                    <strong style={{ color: l.status === 'vencido' ? 'var(--danger,#e53e3e)' : l.status === 'vencendo' ? '#d97706' : 'inherit' }}>
                      {formatDate(l.data_validade)}
                    </strong>
                  </td>
                  <td>{l.quantidade} <span className="text-muted">{l.unidade_medida}</span></td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{formatDate(l.data_entrada)}</td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{l.fornecedor || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
