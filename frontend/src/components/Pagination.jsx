export default function Pagination({ pagina, total, porPagina, onChange }) {
  const totalPaginas = Math.ceil(total / porPagina);
  if (totalPaginas <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '16px 0', fontSize: 13 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => onChange(pagina - 1)} disabled={pagina === 1}>← Anterior</button>
      <span style={{ color: 'var(--text-muted)' }}>Página <strong>{pagina}</strong> de <strong>{totalPaginas}</strong></span>
      <button className="btn btn-ghost btn-sm" onClick={() => onChange(pagina + 1)} disabled={pagina === totalPaginas}>Próximo →</button>
    </div>
  );
}
