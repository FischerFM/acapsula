import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Insumos from './pages/Insumos';
import Procedimentos from './pages/Procedimentos';
import Agendamentos from './pages/Agendamentos';
import ProjecaoSemanal from './pages/ProjecaoSemanal';
import Historico from './pages/Historico';

function Sidebar() {
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
    </aside>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar />
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
