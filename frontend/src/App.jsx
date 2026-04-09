import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Insumos from './pages/Insumos';
import Procedimentos from './pages/Procedimentos';
import Agendamentos from './pages/Agendamentos';
import ProjecaoSemanal from './pages/ProjecaoSemanal';
import Historico from './pages/Historico';
import Login from './pages/Login';

function Sidebar({ usuario, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>aCAPSULA</h1>
        <p>Gestão de Estoque Médico</p>
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          Dashboard
        </NavLink>
        <NavLink to="/insumos" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          Insumos
        </NavLink>
        <NavLink to="/procedimentos" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          Procedimentos
        </NavLink>
        <NavLink to="/agendamentos" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          Agendamentos
        </NavLink>
        <NavLink to="/projecao" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          Projecao Semanal
        </NavLink>
        <NavLink to="/historico" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
          Historico
        </NavLink>
      </nav>
      <div style={{ marginTop: 'auto', padding: '16px 20px', borderTop: '1px solid var(--border)', fontSize: 13 }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}>Logado como <strong>{usuario}</strong></div>
        <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={onLogout}>Sair</button>
      </div>
    </aside>
  );
}

export default function App() {
  const [usuario, setUsuario] = useState(() => localStorage.getItem('acapsula_usuario'));

  function handleLogin(u) { setUsuario(u); }

  function handleLogout() {
    localStorage.removeItem('acapsula_token');
    localStorage.removeItem('acapsula_usuario');
    setUsuario(null);
  }

  if (!usuario) return <Login onLogin={handleLogin} />;

  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar usuario={usuario} onLogout={handleLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/insumos" element={<Insumos />} />
            <Route path="/procedimentos" element={<Procedimentos />} />
            <Route path="/agendamentos" element={<Agendamentos />} />
            <Route path="/projecao" element={<ProjecaoSemanal />} />
            <Route path="/historico" element={<Historico />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
