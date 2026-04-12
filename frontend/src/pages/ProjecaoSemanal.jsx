import { useState, useEffect } from 'react';
import api, { downloadFile } from '../api';

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function addDays(iso, n) {
  return new Date(new Date(iso).getTime() + n * 86400000).toISOString().split('T')[0];
}

function SituacaoBadge({ ins }) {
  if (!ins.suficiente) return <span className="badge badge-critico">Insuficiente</span>;
  if (ins.estoque_minimo > 0 && ins.saldo_final <= ins.estoque_minimo) return <span className="badge badge-atencao">Estoque baixo</span>;
  return <span className="badge badge-ok">OK</span>;
}

export default function ProjecaoSemanal() {
  const [inicio, setInicio] = useState(today());
  const [fim, setFim] = useState(addDays(today(), 6));
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);

  function buscar() {
    setLoading(true);
    api.get(`/dashboard/semana?inicio=${inicio}&fim=${fim}`)
      .then(r => setDados(r.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => { buscar(); }, []);

  return (
    <div>
      <div className="page-header">
        <h2>Projeção Semanal</h2>
      </div>

      {/* Filtro de período */}
      <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>De</label>
        <input
          type="date"
          value={inicio}
          onChange={e => setInicio(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14 }}
        />
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Até</label>
        <input
          type="date"
          value={fim}
          onChange={e => setFim(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14 }}
        />
        <button className="btn btn-primary" onClick={buscar} disabled={loading}>
          {loading ? 'Carregando...' : 'Analisar'}
        </button>
        <button className="btn btn-ghost" onClick={() => { setInicio(today()); setFim(addDays(today(), 6)); }}>
          Esta semana
        </button>
        <button className="btn btn-ghost" onClick={() => { setInicio(addDays(today(), 7)); setFim(addDays(today(), 13)); }}>
          Próxima semana
        </button>
        <button className="btn btn-ghost" onClick={() => downloadFile(`/exportar/projecao?inicio=${inicio}&fim=${fim}`, `projecao_${inicio}_${fim}.xlsx`)}>
          Exportar Excel
        </button>
        {dados && dados.insuficientes > 0 && (
          <button className="btn btn-warning" onClick={() => downloadFile(`/exportar/pedido-compra?inicio=${inicio}&fim=${fim}`, `pedido_compra_${inicio}_${fim}.xlsx`)}>
            Gerar Pedido de Compra
          </button>
        )}
      </div>

      {loading && <div className="loading">Carregando...</div>}

      {!loading && dados && dados.total_agendamentos === 0 && (
        <div className="empty-state">
          Nenhum agendamento confirmado entre {formatDate(inicio)} e {formatDate(fim)}.
        </div>
      )}

      {!loading && dados && dados.total_agendamentos > 0 && (
        <>
          {/* Cards de resumo */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-value">{dados.total_agendamentos}</div>
              <div className="stat-label">Agendamentos no Período</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dados.resumo.length}</div>
              <div className="stat-label">Insumos que Serão Usados</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: dados.insuficientes > 0 ? 'var(--danger, #e53e3e)' : 'inherit' }}>
                {dados.insuficientes}
              </div>
              <div className="stat-label">Insumos Insuficientes</div>
            </div>
          </div>

          {/* Alerta de insuficiência */}
          {dados.insuficientes > 0 && (
            <div style={{ background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#c53030' }}>
              <strong>Atenção:</strong> {dados.insuficientes} insumo(s) não têm estoque suficiente para cobrir todos os procedimentos do período. Considere repor o estoque antes dos atendimentos.
            </div>
          )}

          {/* Tabela de consumo por insumo */}
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Consumo Previsto por Insumo
          </h3>
          <div className="table-card" style={{ marginBottom: 28 }}>
            <table>
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Estoque Atual</th>
                  <th>Consumo Previsto</th>
                  <th>Saldo Final</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {dados.resumo.map(ins => (
                  <tr key={ins.id}>
                    <td><strong>{ins.nome}</strong></td>
                    <td>{ins.estoque_atual} <span className="text-muted">{ins.unidade_medida}</span></td>
                    <td className="text-muted">− {ins.consumo_previsto} <span>{ins.unidade_medida}</span></td>
                    <td>
                      <strong style={{ color: ins.saldo_final < 0 ? 'var(--danger, #e53e3e)' : 'inherit' }}>
                        {ins.saldo_final} <span className="text-muted" style={{ fontWeight: 400 }}>{ins.unidade_medida}</span>
                      </strong>
                    </td>
                    <td><SituacaoBadge ins={ins} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lista de agendamentos */}
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Agendamentos Previstos
          </h3>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Paciente</th>
                  <th>Procedimento</th>
                </tr>
              </thead>
              <tbody>
                {dados.agendamentos.map(ag => (
                  <tr key={ag.id}>
                    <td><strong>{formatDate(ag.data)}</strong></td>
                    <td>{ag.paciente_nome}</td>
                    <td className="text-muted">{ag.procedimento_nome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
