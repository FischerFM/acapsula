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

  // Estoque atual — top 20 mais críticos (menor saldo relativo ao mínimo)
  const estoqueData = (graficos?.estoqueAtual || [])
    .sort((a, b) => {
      const rA = a.estoque_minimo > 0 ? a.estoque_fisico / a.estoque_minimo : a.estoque_fisico;
      const rB = b.estoque_minimo > 0 ? b.estoque_fisico / b.estoque_minimo : b.estoque_fisico;
      return rA - rB;
    })
    .slice(0, 20)
    .map(i => ({
      name: i.nome.length > 16 ? i.nome.slice(0, 14) + '…' : i.nome,
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
              Protocolos Mais Realizados (90 dias)
            </h3>
            {procData.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}>Nenhum protocolo realizado ainda.</div>
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
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Estoque Atual vs Mínimo
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>20 insumos com menor saldo relativo ao mínimo</p>
            {estoqueData.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}>Nenhum insumo cadastrado.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={estoqueData} margin={{ top: 0, right: 10, left: -10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
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
          <h3>Projeção de Estoque por Dia</h3>
          <span className="text-muted" style={{ fontSize: 12 }}>Baseado nos agendamentos confirmados futuros</span>
        </div>
        {dias.length === 0 ? (
          <div className="empty-state">Nenhum agendamento confirmado futuro encontrado.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 16px' }}>
            {dias.map(dia => {
              const consumidos = insumos.filter(ins => dia.estoque[ins.id]?.consumo > 0);
              return (
                <div key={dia.data} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
                    <strong style={{ fontSize: 15, minWidth: 90 }}>{formatDate(dia.data)}</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {dia.agendamentos.map((ag, i) => (
                        <span key={i} style={{ fontSize: 12, background: '#f0f4ff', borderRadius: 4, padding: '2px 8px', color: '#3b5bdb' }}>
                          {ag.paciente} <span style={{ opacity: 0.7 }}>({ag.procedimento})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  {consumidos.length === 0 ? (
                    <span className="text-muted" style={{ fontSize: 12 }}>Nenhum insumo consumido.</span>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {consumidos.map(ins => {
                        const cell = dia.estoque[ins.id];
                        const critico = cell.saldo < 0;
                        return (
                          <div key={ins.id} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: critico ? '#fff5f5' : '#f0faf4', border: `1px solid ${critico ? '#feb2b2' : '#9ae6b4'}`, color: critico ? '#c53030' : '#276749' }}>
                            <strong>{ins.nome}</strong>: −{cell.consumo} {ins.unidade_medida} → saldo {cell.saldo}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
