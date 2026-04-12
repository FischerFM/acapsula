import { useState, useEffect, useRef } from 'react';
import api, { downloadFile } from '../api';
import Modal from '../components/Modal';

const EMPTY_FORM = { nome: '', unidade_medida: '', marca: '', estoque_fisico: '', estoque_minimo: '' };
const EMPTY_ENTRADA = { quantidade: '', fornecedor: '', data: '', observacoes: '', lote: '', data_validade: '' };

function estoqueStatus(insumo) {
  if (insumo.estoque_minimo > 0 && insumo.estoque_fisico <= insumo.estoque_minimo) {
    return insumo.estoque_fisico <= 0 ? 'critico' : 'atencao';
  }
  return 'ok';
}

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

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function Insumos() {
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState({ col: 'nome', dir: 'asc' });

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [entradaModal, setEntradaModal] = useState(false);
  const [entradaInsumo, setEntradaInsumo] = useState(null);
  const [entradaForm, setEntradaForm] = useState(EMPTY_ENTRADA);
  const [entradaError, setEntradaError] = useState('');
  const [savingEntrada, setSavingEntrada] = useState(false);

  const [historicoModal, setHistoricoModal] = useState(false);
  const [historicoInsumo, setHistoricoInsumo] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const load = () => api.get('/insumos').then(r => setInsumos(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  function toggleSort(col) {
    setSort(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }));
  }

  function openCreate() { setForm(EMPTY_FORM); setEditId(null); setFormError(''); setModal('edit'); }
  function openEdit(ins) {
    setForm({ nome: ins.nome, unidade_medida: ins.unidade_medida, marca: ins.marca || '', estoque_fisico: String(ins.estoque_fisico), estoque_minimo: String(ins.estoque_minimo) });
    setEditId(ins.id); setFormError(''); setModal('edit');
  }
  function closeModal() { setModal(null); setEditId(null); setFormError(''); }

  async function handleSave() {
    if (!form.nome.trim() || !form.unidade_medida.trim()) { setFormError('Nome e unidade de medida são obrigatórios.'); return; }
    setSaving(true); setFormError('');
    try {
      const payload = { nome: form.nome.trim(), unidade_medida: form.unidade_medida.trim(), marca: form.marca.trim(), estoque_fisico: parseFloat(form.estoque_fisico) || 0, estoque_minimo: parseFloat(form.estoque_minimo) || 0 };
      if (editId) { await api.put(`/insumos/${editId}`, payload); } else { await api.post('/insumos', payload); }
      closeModal(); load();
    } catch (e) { setFormError(e.response?.data?.error || 'Erro ao salvar.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(ins) {
    if (!window.confirm(`Excluir o insumo "${ins.nome}"?`)) return;
    try { await api.delete(`/insumos/${ins.id}`); load(); }
    catch (e) { alert(e.response?.data?.error || 'Erro ao excluir.'); }
  }

  function openEntrada(ins) {
    setEntradaInsumo(ins);
    setEntradaForm({ ...EMPTY_ENTRADA, data: new Date().toISOString().split('T')[0] });
    setEntradaError(''); setEntradaModal(true);
  }

  async function handleSaveEntrada() {
    if (!entradaForm.quantidade || parseFloat(entradaForm.quantidade) <= 0) { setEntradaError('Informe uma quantidade maior que zero.'); return; }
    setSavingEntrada(true); setEntradaError('');
    try {
      await api.post('/movimentacoes', { insumo_id: entradaInsumo.id, quantidade: parseFloat(entradaForm.quantidade), fornecedor: entradaForm.fornecedor, observacoes: entradaForm.observacoes, data: entradaForm.data, lote: entradaForm.lote, data_validade: entradaForm.data_validade });
      setEntradaModal(false); load();
    } catch (e) { setEntradaError(e.response?.data?.error || 'Erro ao registrar entrada.'); }
    finally { setSavingEntrada(false); }
  }

  async function openHistorico(ins) {
    setHistoricoInsumo(ins); setHistoricoModal(true); setLoadingHistorico(true);
    try { const r = await api.get(`/movimentacoes/insumo/${ins.id}`); setHistorico(r.data); }
    finally { setLoadingHistorico(false); }
  }

  async function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      const r = await api.post('/insumos/importar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImportResult(r.data); load();
    } catch (e) {
      setImportResult({ criados: 0, atualizados: 0, erros: [e.response?.data?.error || 'Erro ao importar.'], total: 0 });
    } finally { setImporting(false); }
  }

  function exportarExcel() {
    downloadFile('/exportar/insumos', 'insumos.xlsx');
  }

  const statusLabel = { ok: 'OK', atencao: 'Atencao', critico: 'Critico' };
  const sorted = applySort(insumos, sort);

  return (
    <div>
      <div className="page-header">
        <h2>Insumos</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={exportarExcel}>Exportar Excel</button>
          <button className="btn btn-ghost" onClick={() => downloadFile('/exportar/modelo-insumos', 'modelo_insumos.xlsx')}>
            Baixar Modelo
          </button>
          <button className="btn btn-ghost" onClick={() => fileInputRef.current.click()} disabled={importing}>
            {importing ? 'Importando...' : 'Importar Excel'}
          </button>
          <input type="file" ref={fileInputRef} accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportFile} />
          <button className="btn btn-primary" onClick={openCreate}>+ Novo Insumo</button>
        </div>
      </div>

      <div className="table-card">
        {loading ? <div className="loading">Carregando...</div> : insumos.length === 0 ? <div className="empty-state">Nenhum insumo cadastrado.</div> : (
          <table>
            <thead>
              <tr>
                <SortTh col="nome" sort={sort} onSort={toggleSort}>Nome</SortTh>
                <SortTh col="marca" sort={sort} onSort={toggleSort}>Marca</SortTh>
                <SortTh col="unidade_medida" sort={sort} onSort={toggleSort}>Unidade</SortTh>
                <SortTh col="estoque_fisico" sort={sort} onSort={toggleSort}>Estoque Fisico</SortTh>
                <SortTh col="estoque_minimo" sort={sort} onSort={toggleSort}>Estoque Minimo</SortTh>
                <th>Status</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(ins => {
                const st = estoqueStatus(ins);
                return (
                  <tr key={ins.id}>
                    <td><strong>{ins.nome}</strong></td>
                    <td className="text-muted">{ins.marca || '—'}</td>
                    <td className="text-muted">{ins.unidade_medida}</td>
                    <td><strong style={{ fontSize: 15 }}>{ins.estoque_fisico}</strong> <span className="text-muted">{ins.unidade_medida}</span></td>
                    <td className="text-muted">{ins.estoque_minimo || '—'}</td>
                    <td><span className={`badge badge-${st}`}>{statusLabel[st]}</span></td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-success btn-sm" onClick={() => openEntrada(ins)}>+ Entrada</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => openHistorico(ins)}>Historico</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(ins)}>Editar</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(ins)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: criar/editar */}
      {modal === 'edit' && (
        <Modal title={editId ? 'Editar Insumo' : 'Novo Insumo'} onClose={closeModal}
          footer={<><button className="btn btn-ghost" onClick={closeModal}>Cancelar</button><button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button></>}>
          <div className="form-group"><label>Nome do Insumo</label>
            <input type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Insulina Glargina" />
          </div>
          <div className="form-row">
            <div className="form-group"><label>Unidade de Medida</label>
              <input type="text" value={form.unidade_medida} onChange={e => setForm(f => ({ ...f, unidade_medida: e.target.value }))} placeholder="Ex: frasco, ml" />
            </div>
            <div className="form-group"><label>Marca (opcional)</label>
              <input type="text" value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} placeholder="Ex: Novo Nordisk" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Estoque Fisico Atual</label>
              <input type="number" min="0" step="any" value={form.estoque_fisico} onChange={e => setForm(f => ({ ...f, estoque_fisico: e.target.value }))} placeholder="0" />
            </div>
            <div className="form-group"><label>Estoque Minimo (alerta)</label>
              <input type="number" min="0" step="any" value={form.estoque_minimo} onChange={e => setForm(f => ({ ...f, estoque_minimo: e.target.value }))} placeholder="0" />
            </div>
          </div>
          {formError && <div className="error-msg">{formError}</div>}
        </Modal>
      )}

      {/* Modal: entrada de estoque */}
      {entradaModal && entradaInsumo && (
        <Modal title={`Entrada de Estoque — ${entradaInsumo.nome}`} onClose={() => setEntradaModal(false)}
          footer={<><button className="btn btn-ghost" onClick={() => setEntradaModal(false)}>Cancelar</button><button className="btn btn-success" onClick={handleSaveEntrada} disabled={savingEntrada}>{savingEntrada ? 'Salvando...' : 'Registrar Entrada'}</button></>}>
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
            Estoque atual: <strong>{entradaInsumo.estoque_fisico} {entradaInsumo.unidade_medida}</strong>
          </p>
          <div className="form-row">
            <div className="form-group"><label>Quantidade Recebida</label>
              <input type="number" min="0.01" step="any" value={entradaForm.quantidade} onChange={e => setEntradaForm(f => ({ ...f, quantidade: e.target.value }))} placeholder="0" autoFocus />
            </div>
            <div className="form-group"><label>Data do Recebimento</label>
              <input type="date" value={entradaForm.data} onChange={e => setEntradaForm(f => ({ ...f, data: e.target.value }))} />
            </div>
          </div>
          <div className="form-group"><label>Fornecedor (opcional)</label>
            <input type="text" value={entradaForm.fornecedor} onChange={e => setEntradaForm(f => ({ ...f, fornecedor: e.target.value }))} placeholder="Ex: Distribuidora MedFarma" />
          </div>
          <div className="form-row">
            <div className="form-group"><label>Lote (opcional)</label>
              <input type="text" value={entradaForm.lote} onChange={e => setEntradaForm(f => ({ ...f, lote: e.target.value }))} placeholder="Ex: LOT2024A" />
            </div>
            <div className="form-group"><label>Data de Validade (opcional)</label>
              <input type="date" value={entradaForm.data_validade} onChange={e => setEntradaForm(f => ({ ...f, data_validade: e.target.value }))} />
            </div>
          </div>
          <div className="form-group"><label>Observacoes (opcional)</label>
            <input type="text" value={entradaForm.observacoes} onChange={e => setEntradaForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Ex: NF 12345" />
          </div>
          {entradaError && <div className="error-msg">{entradaError}</div>}
        </Modal>
      )}

      {/* Modal: histórico do insumo */}
      {historicoModal && historicoInsumo && (
        <Modal title={`Historico — ${historicoInsumo.nome}`} onClose={() => setHistoricoModal(false)} size="lg"
          footer={<button className="btn btn-primary" onClick={() => setHistoricoModal(false)}>Fechar</button>}>
          {loadingHistorico ? <div className="loading">Carregando...</div> : historico.length === 0 ? (
            <div className="empty-state">Nenhuma movimentação registrada ainda.</div>
          ) : (
            <table>
              <thead><tr><th>Data</th><th>Tipo</th><th>Quantidade</th><th>Saldo Apos</th><th>Fornecedor / Origem</th></tr></thead>
              <tbody>
                {historico.map(m => (
                  <tr key={m.id}>
                    <td>{formatDate(m.data)}</td>
                    <td><span className={`badge ${m.tipo === 'Entrada' ? 'badge-ok' : m.tipo === 'Ajuste' ? 'badge-confirmado' : 'badge-cancelado'}`}>{m.tipo}</span></td>
                    <td><strong style={{ color: m.tipo === 'Saída' ? 'var(--danger, #e53e3e)' : 'var(--success, #38a169)' }}>
                      {m.tipo === 'Saída' ? '−' : '+'}{m.quantidade} {historicoInsumo.unidade_medida}
                    </strong></td>
                    <td>{m.saldo_apos} {historicoInsumo.unidade_medida}</td>
                    <td className="text-muted" style={{ fontSize: 12 }}>{m.fornecedor || m.observacoes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}

      {/* Modal: resultado da importação */}
      {importResult && (
        <Modal title="Resultado da Importação" onClose={() => setImportResult(null)}
          footer={<button className="btn btn-primary" onClick={() => setImportResult(null)}>OK</button>}>
          <p style={{ fontSize: 15 }}>
            <strong>{importResult.criados}</strong> criado(s) e <strong>{importResult.atualizados}</strong> atualizado(s) de <strong>{importResult.total}</strong> linha(s).
          </p>
          {importResult.erros?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger, #e53e3e)', marginBottom: 8 }}>{importResult.erros.length} erro(s):</p>
              <ul style={{ fontSize: 13, color: 'var(--danger, #e53e3e)', paddingLeft: 20, lineHeight: 1.8 }}>
                {importResult.erros.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            </div>
          )}
          <p className="text-muted" style={{ fontSize: 12, marginTop: 12 }}>
            Formato esperado: colunas <strong>Item</strong>, <strong>Unidade</strong>, <strong>Marca</strong>, <strong>Saldo Atual</strong>
          </p>
        </Modal>
      )}
    </div>
  );
}
