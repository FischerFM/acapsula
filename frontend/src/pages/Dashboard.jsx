import { useState, useEffect } from 'react';
import api from '../api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function formatMes(ym) {
  const [y, m] = ym.split('-');
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${meses[parseInt(m) - 1]}/${y.slice(2)}`;
}

const CHART_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16'];

export default function Dashboard() {
  const [resumo, setResumo]     = useState(null);
  const [projecao, setProjecao] = useState(null);
  const [validades, setValidades] = useState(null);
  const [graficos, setGraficos] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/resumo'),
      api.get('/dashboard/projecao'),
      api.get('/dashboard/validades'),
      api.get('/dashboard/graficos'),
    ])
      .then(([r1, r2, r3, r4]) => {
        setResumo(r1.data);
        setProjecao(r2.data);
        setValidades(r3.data);
        setGraficos(r4.data);
      })
      .catch(() => setError('Não foi possível conectar ao servidor. Verifique se o backend está rodando.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Carregando...</div>;
  if (error) return (
    <div>
      <div className="page-header"><h2>Dashboard</h2></div>
      <div className="alert-panel"><div className="alert-item critico">{error}</div></div>
    </div>
  );

  const { alertas = [], insumos = [], projecao: dias = [] } = projecao;
  const totalAlertas = alertas.length + (validades?.total || 0);

  // Monta dados do gráfico de fluxo mensal
  const fluxoData = (graficos?.fluxoMensal || []).map(f => ({
    mes: formatMes(f.mes),
    Entradas: Math.round(f.entradas * 10) / 10,
    Saidas: Math.round(f.saidas * 10) / 10,
  }));

  // Procedimentos mais realizados
  const procData = graficos?.topProcedimentos || [];

  // Estoque atual (barras)
  const estoqueData = (graficos?.estoqueAtual || []).map(i => ({
    name: i.nome.length > 18 ? i.nome.slice(0, 16) + '…' : i.nome,
    Atual: i.estoque_fisico,
    Minimo: i.estoque_minimo,
  }));

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <span className="text-muted" style={{ fontSize: 13 }}>
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* Cards */}
      <div className="cards-row">
        <div className="stat-card">
          <div className="label">Insumos Cadastrados</div>
          <div className="value">{resumo.total_insumos}</div>
        </div>
        <div className="stat-card success">
          <div className="label">Agendamentos Hoje</div>
          <div className="value">{resumo.agendamentos_hoje}</div>
        </div>
        <div className="stat-card warning">
          <div className="label">Próximos 7 Dias</div>
          <div className="value">{resumo.agendamentos_semana}</div>
        </div>
        <div className={`stat-card ${totalAlertas > 0 ? 'danger' : 'success'}`}>
          <div className="label">Alertas Ativos</div>
          <div className="value">{totalAlertas}</div>
        </div>
      </div>

      {/* Alertas de validade */}
      {validades && validades.total > 0 && (
        <div className="alert-panel" style={{ marginBottom: 12 }}>
          <h3>Alertas de Validade</h3>
          {validades.vencidos.map((l, i) => (
            <div key={i} className="alert-item critico">
              <span className="alert-badge critico">VENCIDO</span>
              <span>
                <strong>{l.insumo_nome}</strong>
                {l.lote ? ` — Lote ${l.lote}` : ''}: venceu em <strong>{formatDate(l.data_validade)}</strong>.
                Quantidade: {l.quantidade} {l.unidade_medida}.
              </span>
            </div>
          ))}
          {validades.vencendo.map((l, i) => (
            <div key={i} className="alert-item atencao">
              <span className="alert-badge atencao">VENCENDO</span>
              <span>
                <strong>{l.insumo_nome}</strong>
                {l.lote ? ` — Lote ${l.lote}` : ''}: vence em <strong>{formatDate(l.data_validade)}</strong>.
                Quantidade: {l.quantidade} {l.unidade_medida}.
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Alertas de estoque */}
      <div className="alert-panel">
        <h3>Alertas de Estoque</h3>
        {alertas.length === 0 ? (
          <div className="alert-item" style={{ background: '#eafaf1', borderLeft: '3px solid #27ae60', color: '#1e8449' }}>
            Nenhum alerta. Estoque suficiente para todos os agendamentos confirmados.
          </div>
        ) : alertas.map((a, i) => (
          <div key={i} className={`alert-item ${a.tipo}`}>
            <span className={`alert-badge ${a.tipo}`}>{a.tipo === 'critico' ? 'CRITICO' : 'ATENCAO'}</span>
            <span>
              {a.tipo === 'critico'
                ? <><strong>{a.insumo}</strong>: estoque zerará em <strong>{formatDate(a.data_critica)}</strong>. Deficit de <strong>{a.deficit} {a.unidade}</strong>.</>
                : <><strong>{a.insumo}</strong>: {a.mensagem}</>
              }
            </span>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      {graficos && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

          {/* Fluxo mensal */}
          <div className="table-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Entradas vs Saídas (últimos 6 meses)
            </h3>
            {fluxoData.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}>Sem dados ainda.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={fluxoData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Entradas" fill="#10b981" radius={[3,3,0,0]} />
                  <Bar dataKey="Saidas" fill="#ef4444" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top procedimentos */}
          <div className="table-card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Procedimentos Mais Realizados (90 dias)
            </h3>
            {procData.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}>Nenhum procedimento realizado ainda.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={procData} dataKey="total" nameKey="nome" cx="50%" cy="50%" outerRadius={80} label={({ nome, percent }) => `${nome.slice(0,14)} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {procData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Estoque atual */}
          <div className="table-card" style={{ padding: 20, gridColumn: '1 / -1' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Estoque Atual vs Mínimo (por insumo)
            </h3>
            {estoqueData.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}>Nenhum insumo cadastrado.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={estoqueData} margin={{ top: 0, right: 10, left: -10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Atual" fill="#3b82f6" radius={[3,3,0,0]} />
                  <Bar dataKey="Minimo" fill="#f59e0b" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Projeção dia a dia */}
      <div className="table-card">
        <div className="table-card-header">
          <h3>Projecao de Estoque por Dia</h3>
          <span className="text-muted" style={{ fontSize: 12 }}>Baseado nos agendamentos confirmados futuros</span>
        </div>
        {dias.length === 0 ? (
          <div className="empty-state">Nenhum agendamento confirmado futuro encontrado.</div>
        ) : (
          <div className="proj-table-wrap">
            <table className="proj-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Pacientes</th>
                  {insumos.map(ins => (
                    <th key={ins.id} className="insumo-header">
                      {ins.nome}
                      <div style={{ fontWeight: 400, fontSize: 11, marginTop: 2 }}>Atual: {ins.estoque_fisico} {ins.unidade_medida}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dias.map(dia => (
                  <tr key={dia.data}>
                    <td><strong>{formatDate(dia.data)}</strong></td>
                    <td>{dia.agendamentos.map((ag, i) => <div key={i} style={{ fontSize: 12 }}>{ag.paciente} <span className="text-muted">({ag.procedimento})</span></div>)}</td>
                    {insumos.map(ins => {
                      const cell = dia.estoque[ins.id];
                      const isCritico = cell.saldo < 0;
                      const hasConsumo = cell.consumo > 0;
                      return (
                        <td key={ins.id} className={`proj-cell ${isCritico ? 'critico' : hasConsumo ? 'consumo' : 'ok'}`}>
                          {hasConsumo ? (
                            <>
                              <div className="proj-consumo">-{cell.consumo} {ins.unidade_medida}</div>
                              <div className="proj-saldo">{isCritico ? <span style={{ color: 'var(--danger)' }}>Saldo: {cell.saldo}</span> : <span>Saldo: {cell.saldo}</span>}</div>
                            </>
                          ) : <span className="text-muted">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
