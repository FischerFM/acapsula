import { useState, useEffect, useRef } from 'react';
import api, { downloadFile } from '../api';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';

const POR_PAGINA = 20;

const EMPTY_FORM = { nome: '', descricao: '' };

export default function Procedimentos() {
  const [procedimentos, setProcedimentos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'form' | 'bom'
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [bomProcId, setBomProcId] = useState(null);
  const [bomProcNome, setBomProcNome] = useState('');
  const [bom, setBom] = useState([]);
  const [newItem, setNewItem] = useState({ insumo_id: '', quantidade: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const loadProcs = () => api.get('/procedimentos').then(r => setProcedimentos(r.data));
  const loadInsumos = () => api.get('/insumos').then(r => setInsumos(r.data));

  useEffect(() => {
    Promise.all([loadProcs(), loadInsumos()]).finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setFormError('');
    setModal('form');
  }

  function openEdit(proc) {
    setForm({ nome: proc.nome, descricao: proc.descricao || '' });
    setEditId(proc.id);
    setFormError('');
    setModal('form');
  }

  async function openBom(proc) {
    setBomProcId(proc.id);
    setBomProcNome(proc.nome);
    setNewItem({ insumo_id: '', quantidade: '' });
    setFormError('');
    const r = await api.get(`/receitas/procedimento/${proc.id}`);
    setBom(r.data);
    setModal('bom');
  }

  function closeModal() {
    setModal(null);
    setEditId(null);
    setBomProcId(null);
    setFormError('');
  }

  async function handleSaveProc() {
    if (!form.nome.trim()) { setFormError('Nome é obrigatório.'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (editId) {
        await api.put(`/procedimentos/${editId}`, form);
      } else {
        await api.post('/procedimentos', form);
      }
      closeModal();
      loadProcs();
    } catch (e) {
      setFormError(e.response?.data?.error || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(proc) {
    if (!window.confirm(`Excluir o procedimento "${proc.nome}"?`)) return;
    try {
      await api.delete(`/procedimentos/${proc.id}`);
      loadProcs();
    } catch (e) {
      alert(e.response?.data?.error || 'Erro ao excluir.');
    }
  }

  function addBomItem() {
    if (!newItem.insumo_id || !newItem.quantidade || parseFloat(newItem.quantidade) <= 0) {
      setFormError('Selecione um insumo e informe a quantidade.');
      return;
    }
    if (bom.find(b => String(b.insumo_id) === String(newItem.insumo_id))) {
      setFormError('Este insumo já está na receita.');
      return;
    }
    const ins = insumos.find(i => i.id === parseInt(newItem.insumo_id));
    setBom(prev => [...prev, {
      insumo_id: parseInt(newItem.insumo_id),
      insumo_nome: ins?.nome || '',
      unidade_medida: ins?.unidade_medida || '',
      quantidade: parseFloat(newItem.quantidade),
    }]);
    setNewItem({ insumo_id: '', quantidade: '' });
    setFormError('');
  }

  function removeBomItem(insumo_id) {
    setBom(prev => prev.filter(b => b.insumo_id !== insumo_id));
  }

  function updateBomQty(insumo_id, val) {
    setBom(prev => prev.map(b => b.insumo_id === insumo_id ? { ...b, quantidade: parseFloat(val) || 0 } : b));
  }

  async function handleSaveBom() {
    setSaving(true);
    setFormError('');
    try {
      await api.put(`/receitas/procedimento/${bomProcId}`, {
        items: bom.map(b => ({ insumo_id: b.insumo_id, quantidade: b.quantidade })),
      });
      closeModal();
      loadProcs();
    } catch (e) {
      setFormError(e.response?.data?.error || 'Erro ao salvar receita.');
    } finally {
      setSaving(false);
    }
  }

  async function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('arquivo', file);
      const r = await api.post('/procedimentos/importar', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImportResult(r.data); loadProcs();
    } catch (e) {
      setImportResult({ criados: 0, atualizados: 0, erros: [e.response?.data?.error || 'Erro ao importar.'], total: 0 });
    } finally { setImporting(false); }
  }

  const availableInsumos = insumos.filter(i => !bom.find(b => b.insumo_id === i.id));

  let filtrados = procedimentos;
  if (busca.trim()) filtrados = filtrados.filter(p =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (p.descricao || '').toLowerCase().includes(busca.toLowerCase())
  );
  const totalFiltrado = filtrados.length;
  const listaPagina = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <div>
      <div className="page-header">
        <h2>Procedimentos</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => downloadFile('/exportar/modelo-procedimentos', 'modelo_procedimentos.xlsx')}>Baixar Modelo</button>
          <button className="btn btn-ghost" onClick={() => fileInputRef.current.click()} disabled={importing}>
            {importing ? 'Importando...' : 'Importar Excel'}
          </button>
          <input type="file" ref={fileInputRef} accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportFile} />
          <button className="btn btn-primary" onClick={openCreate}>+ Novo Procedimento</button>
        </div>
      </div>

      <div className="filter-bar" style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Buscar por nome ou descrição..."
          value={busca}
          onChange={e => { setBusca(e.target.value); setPagina(1); }}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14, minWidth: 220 }}
        />
        {busca && <button className="btn btn-ghost btn-sm" onClick={() => { setBusca(''); setPagina(1); }}>Limpar</button>}
        <span className="text-muted" style={{ fontSize: 13, marginLeft: 'auto' }}>{totalFiltrado} procedimento(s)</span>
      </div>

      <div className="table-card">
        {loading ? (
          <div className="loading">Carregando...</div>
        ) : procedimentos.length === 0 ? (
          <div className="empty-state">Nenhum procedimento cadastrado.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Descricao</th>
                <th>Insumos na Receita</th>
                <th>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {listaPagina.map(proc => (
                <tr key={proc.id}>
                  <td><strong>{proc.nome}</strong></td>
                  <td className="text-muted">{proc.descricao || '—'}</td>
                  <td>
                    <span className={`badge ${proc.total_insumos > 0 ? 'badge-ok' : 'badge-atencao'}`}>
                      {proc.total_insumos} insumo{proc.total_insumos !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td>
                    <div className="btn-group">
                      <button className="btn btn-ghost btn-sm" onClick={() => openBom(proc)}>
                        Editar Receita
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(proc)}>Editar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(proc)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination pagina={pagina} total={totalFiltrado} porPagina={POR_PAGINA} onChange={p => { setPagina(p); window.scrollTo(0,0); }} />
      </div>

      {/* Modal: criar/editar procedimento */}
      {modal === 'form' && (
        <Modal
          title={editId ? 'Editar Procedimento' : 'Novo Procedimento'}
          onClose={closeModal}
          footer={
            <>
              <button className="btn btn-ghost" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveProc} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          }
        >
          <div className="form-group">
            <label>Nome do Procedimento</label>
            <input
              type="text"
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Aplicação de Insulina"
            />
          </div>
          <div className="form-group">
            <label>Descricao (opcional)</label>
            <textarea
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Descreva o procedimento..."
            />
          </div>
          {formError && <div className="error-msg">{formError}</div>}
        </Modal>
      )}

      {/* Modal: editar receita (BOM) */}
      {modal === 'bom' && (
        <Modal
          title={`Receita: ${bomProcNome}`}
          onClose={closeModal}
          size="lg"
          footer={
            <>
              <button className="btn btn-ghost" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveBom} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Receita'}
              </button>
            </>
          }
        >
          <p className="text-muted" style={{ marginBottom: 16, fontSize: 13 }}>
            Defina quais insumos e quantidades sao necessarios para este procedimento.
            Estes valores serao usados para calcular o estoque projetado.
          </p>

          {bom.length > 0 ? (
            <div className="bom-list">
              {bom.map(item => (
                <div key={item.insumo_id} className="bom-item">
                  <span style={{ flex: 1 }}><strong>{item.insumo_nome}</strong></span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={item.quantidade}
                      onChange={e => updateBomQty(item.insumo_id, e.target.value)}
                      style={{ width: 80, padding: '4px 8px', fontSize: 13 }}
                    />
                    <span className="text-muted" style={{ fontSize: 12, minWidth: 60 }}>
                      {item.unidade_medida}
                    </span>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => removeBomItem(item.insumo_id)}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '16px', background: '#f7f9fc', borderRadius: 6, marginBottom: 12, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
              Nenhum insumo na receita. Adicione abaixo.
            </div>
          )}

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
              ADICIONAR INSUMO
            </label>
            <div className="bom-add">
              <select
                value={newItem.insumo_id}
                onChange={e => setNewItem(n => ({ ...n, insumo_id: e.target.value }))}
              >
                <option value="">Selecione o insumo...</option>
                {availableInsumos.map(ins => (
                  <option key={ins.id} value={ins.id}>{ins.nome} ({ins.unidade_medida})</option>
                ))}
              </select>
              <input
                type="number"
                min="0.01"
                step="any"
                placeholder="Qtd"
                value={newItem.quantidade}
                onChange={e => setNewItem(n => ({ ...n, quantidade: e.target.value }))}
              />
              <button className="btn btn-success" onClick={addBomItem}>Adicionar</button>
            </div>
          </div>

          {formError && <div className="error-msg" style={{ marginTop: 8 }}>{formError}</div>}
        </Modal>
      )}
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
            Formato esperado: colunas <strong>Nome</strong> e <strong>Descricao</strong>
          </p>
        </Modal>
      )}
    </div>
  );
}
