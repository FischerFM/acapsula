import { useState } from 'react';
import api from '../api';

export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!usuario.trim() || !senha) { setErro('Preencha usuário e senha.'); return; }
    setLoading(true); setErro('');
    try {
      const r = await api.post('/auth/login', { usuario, senha });
      localStorage.setItem('acapsula_token', r.data.token);
      localStorage.setItem('acapsula_usuario', r.data.usuario);
      onLogin(r.data.usuario);
    } catch (e) {
      setErro(e.response?.data?.error || 'Erro ao conectar.');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg, #f7f8fa)' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '40px 36px', width: '100%', maxWidth: 380, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>aCAPSULA</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Gestão de Estoque Médico</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Usuário</label>
            <input type="text" value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="admin" autoFocus />
          </div>
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label>Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" />
          </div>
          {erro && <div className="error-msg" style={{ marginBottom: 16 }}>{erro}</div>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
