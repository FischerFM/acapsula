import { useState, useEffect, useRef } from 'react';
import api, { API_BASE } from '../api';
import Modal from '../components/Modal';

const EMPTY_FORM = { paciente_nome: '', cpf: '', data: '', procedimento_id: '', status: 'Confirmado', observacoes: '' };

function formatCPF(v) {
  return v.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const STATUS_BADGE = {
  Confirmado: 'badge-confirmado',
  Realizado: 'badge-realizado',
  Cancelado: 'badge-cancelado',
};

function SortTh({ col, sort, onSort, children }) {
  const active = sort.col === col;
  return (
    <th onClick={() => onSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      {children} <span style={{ opacity: active ? 1 : 0.25, fontSize: 11 }}>{active ? (sort.dir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </th>
  );
}

function applySort(arr, sort) {
  if (!sort.col) return arr;
  return [...arr].sort((a, b) => {
    const v1 = a[sort.col] ?? '';
    const v2 = b[sort.col] ?? '';
    const cmp = typeof v1 === 'number' ? v1 - v2 : String(v1).localeCompare(String(v2), 'pt-BR');
    return sort.dir === 'asc' ? cmp : -cmp;
  });
}

export default function Agendamentos() {
  const [agendamentos, setAgendamentos] = useState([]);
  const [procedimentos, setProcedimentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [busca, setBusca] = useState('');
  const [sort, setSort] = useState({ col: 'data', dir: 'desc' });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const load = () => api.get('/agendamentos').then(r => setAgendamentos(r.data));
  const loadProcs = () => api.get('/procedimentos').then(r => setProcedimentos(r.data));

  useEffect(() => {
    Promise.all([load(), loadProcs()]).finally(() => setLoading(false));
  }, []);

  function toggleSort(col) {
    setSort(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }));
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM, data: new Date().toISOString().split('T')[0] });
    setEditId(null); setFormError(''); setModal(true);
  }

  function openEdit(ag) {
    setForm({ paciente_nome: ag.paciente_nome, cpf: ag.cpf || '', data: ag.data, procedimento_id: String(ag.procedimento_id), status: ag.status, observacoes: ag.observacoes || '' });
    setEditId(ag.id); setFormError(''); setModal(true);
  }

  function closeModal() { setModal(false); setEditId(null); setFormError(''); }

  async function handleSave() {
    if (!form.paciente_nome.trim() || !form.data || !form.procedimento_id) {
      setFormError('Paciente, data e procedimento são obrigatórios.'); return;
    }
    setSaving(true); setFormError('');
    try {
      const payload = { ...form, procedimento_id: parseInt(form.procedimento_id) };
      if (editId) { await api.put(`/agendamentos/${editId}`, payload); } else { await api.post('/agendamentos', payload); }
      closeModal(); load();
    } catch (e) { setFormError(e.response?.data?.error || 'Erro ao salvar.'); }
    finally { setSaving(false); }
  }

  async function setStatus(ag, status) {
    const aviso = status === 'Realizado'
      ? `Marcar "${ag.paciente_nome}" como Realizado?\n\nIsso irá debitar automaticamente os insumos do estoque físico.`
      : `Cancelar o agendamento de "${ag.paciente_nome}"?`;
    if (!window.confirm(aviso)) return;
    try { await api.put(`/agendamentos/${ag.id}`, { status }); load(); }
    catch (e) { alert(e.response?.data?.error || 'Erro ao atualizar status.'); }
  }

  async function handleDelete(ag) {
    if (!window.confirm(`Excluir o agendamento de "${ag.paciente_nome}" em ${formatDate(ag.data)}?`)) return;
    try { await api.delete(`/agendamentos/${ag.id}`); load(); }
    catch (e) { alert(e.response?.data?.error || 'Erro ao excluir.'); }
  }

  async function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      const r = await api.post('/agendamentos/importar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImportResult(r.data); load();
    } catch (e) {
      setImportResult({ importados: 0, erros: [e.response?.data?.error || 'Erro ao importar.'], total: 0 });
    } finally { setImporting(false); }
  }

  // Filtros: status + busca por nome ou CPF
  let lista = agendamentos;
  if (filtroStatus) lista = lista.filter(a => a.status === filtroStatus);
  if (busca.trim()) lista = lista.filter(a =>
    a.paciente_nome.toLowerCase().includes(busca.toLowerCase()) ||
    (a.cpf || '').replace(/\D/g, '').includes(busca.replace(/\D/g, ''))
  );
  lista = applySort(lista, sort);

  return (
    <div>
      <div className="page-header">
        <h2>Agendamentos</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => window.open(`${API_BASE}/exportar/modelo-agendamentos`, '_blank')}>
            Baixar Modelo
          </button>
          <button className="btn btn-ghost" onClick={() => fileInputRef.current.click()} disabled={importing}>
            {importing ? 'Importando...' : 'Importar Excel'}
          </button>
          <input type="file" ref={fileInputRef} accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportFile} />
          <button className="btn btn-primary" onClick={openCreate}>+ Novo Agendamento</button>
        </div>
      </div>

      <div className="filter-bar" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Buscar por nome ou CPF..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14, minWidth: 220 }}
        />
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="Confirmado">Confirmado</option>
          <option value="Realizado">Realizado</option>
          <option value="Cancelado">Cancelado</option>
        </select>
        {(busca || filtroStatus) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setBusca(''); setFiltroStatus(''); }}>
            Limpar filtros
          </button>
        )}
        <span className="text-muted" style={{ fontSize: 13, marginLeft: 'auto' }}>
          {lista.length} agendamento(s)
        </span>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="loading">Carregando...</div>
        ) : lista.length === 0 ? (
          <div className="empty-state">Nenhum agendamento encontrado.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <SortTh col="data" sort={sort} onSort={toggleSort}>Data</SortTh>
                <SortTh col="paciente_nome" sort={sort} onSort={toggleSort}>Paciente</SortTh>
                <SortTh col="procedimento_nome" sort={sort} onSort={toggleSort}>Procedimento</SortTh>
                <th>CPF</th>
                <SortTh col="status" sort={sort} onSort={toggleSort}>Status</SortTh>
                <th>Observacoes</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(ag => (
                <tr key={ag.id}>
                  <td><strong>{formatDate(ag.data)}</strong></td>
                  <td>{ag.paciente_nome}</td>
                  <td className="text-muted">{ag.procedimento_nome}</td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{ag.cpf || '—'}</td>
                  <td><span className={`badge ${STATUS_BADGE[ag.status] || ''}`}>{ag.status}</span></td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{ag.observacoes || '—'}</td>
                  <td>
                    <div className="btn-group">
                      {ag.status === 'Confirmado' && (
                        <>
                          <button className="btn btn-success btn-sm" onClick={() => setStatus(ag, 'Realizado')} title="Marcar como realizado e debitar estoque">Realizado</button>
                          <button className="btn btn-warning btn-sm" onClick={() => setStatus(ag, 'Cancelado')}>Cancelar</button>
                        </>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(ag)}>Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(ag)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: criar/editar agendamento */}
      {modal && (
        <Modal title={editId ? 'Editar Agendamento' : 'Novo Agendamento'} onClose={closeModal}
          footer={<><button className="btn btn-ghost" onClick={closeModal}>Cancelar</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></>}>
          <div className="form-row">
            <div className="form-group"><label>Nome do Paciente</label>
              <input type="text" value={form.paciente_nome} onChange={e => setForm(f => ({ ...f, paciente_nome: e.target.value }))} placeholder="Ex: Guilherme Silva" />
            </div>
            <div className="form-group"><label>CPF (opcional)</label>
              <input type="text" value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: formatCPF(e.target.value) }))} placeholder="000.000.000-00" maxLength={14} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Data</label>
              <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div className="form-group"><label>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="Confirmado">Confirmado</option>
                <option value="Realizado">Realizado</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>
          </div>
          <div className="form-group"><label>Procedimento</label>
            <select value={form.procedimento_id} onChange={e => setForm(f => ({ ...f, procedimento_id: e.target.value }))}>
              <option value="">Selecione o procedimento...</option>
              {procedimentos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Observacoes (opcional)</label>
            <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Informacoes adicionais..." />
          </div>
          {formError && <div className="error-msg">{formError}</div>}
        </Modal>
      )}

      {/* Modal: resultado da importação */}
      {importResult && (
        <Modal title="Resultado da Importação" onClose={() => setImportResult(null)}
          footer={<button className="btn btn-primary" onClick={() => setImportResult(null)}>OK</button>}>
          <p style={{ fontSize: 15 }}><strong>{importResult.importados}</strong> de <strong>{importResult.total}</strong> agendamento(s) importado(s) com sucesso.</p>
          {importResult.erros.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger, #e53e3e)', marginBottom: 8 }}>{importResult.erros.length} erro(s):</p>
              <ul style={{ fontSize: 13, color: 'var(--danger, #e53e3e)', paddingLeft: 20, lineHeight: 1.8 }}>
                {importResult.erros.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
