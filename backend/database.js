const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS insumos (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      unidade_medida TEXT NOT NULL,
      marca TEXT DEFAULT '',
      estoque_fisico REAL NOT NULL DEFAULT 0,
      estoque_minimo REAL NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS procedimentos (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS receita_procedimento (
      id SERIAL PRIMARY KEY,
      procedimento_id INTEGER NOT NULL REFERENCES procedimentos(id) ON DELETE CASCADE,
      insumo_id INTEGER NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
      quantidade REAL NOT NULL,
      UNIQUE(procedimento_id, insumo_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS agendamentos (
      id SERIAL PRIMARY KEY,
      paciente_nome TEXT NOT NULL,
      cpf TEXT DEFAULT '',
      data TEXT NOT NULL,
      procedimento_id INTEGER NOT NULL REFERENCES procedimentos(id),
      status TEXT NOT NULL DEFAULT 'Confirmado',
      observacoes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
      id SERIAL PRIMARY KEY,
      insumo_id INTEGER NOT NULL REFERENCES insumos(id),
      tipo TEXT NOT NULL,
      quantidade REAL NOT NULL,
      saldo_apos REAL NOT NULL,
      fornecedor TEXT DEFAULT '',
      observacoes TEXT DEFAULT '',
      lote TEXT DEFAULT '',
      data_validade TEXT DEFAULT '',
      data TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      usuario TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Cria usuário padrão se não existir
  const { rows: users } = await pool.query('SELECT COUNT(*) as c FROM usuarios');
  if (parseInt(users[0].c) === 0) {
    const hash = await bcrypt.hash('acapsula123', 10);
    await pool.query('INSERT INTO usuarios (usuario, senha_hash) VALUES ($1, $2)', ['admin', hash]);
    console.log('[DB] Usuário padrão criado: admin / acapsula123');
  }

  // Seed apenas se banco vazio
  const { rows } = await pool.query('SELECT COUNT(*) as c FROM insumos');
  if (parseInt(rows[0].c) === 0) {
    const today = new Date().toISOString().split('T')[0];
    const d1 = new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0];
    const d2 = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];
    const d3 = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
    const d6 = new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0];

    const i1 = (await pool.query('INSERT INTO insumos (nome,unidade_medida,estoque_fisico,estoque_minimo) VALUES ($1,$2,$3,$4) RETURNING id', ['Insulina Glargina','frasco',5,2])).rows[0].id;
    const i2 = (await pool.query('INSERT INTO insumos (nome,unidade_medida,estoque_fisico,estoque_minimo) VALUES ($1,$2,$3,$4) RETURNING id', ['Seringa 1mL','unidade',20,5])).rows[0].id;
    const i3 = (await pool.query('INSERT INTO insumos (nome,unidade_medida,estoque_fisico,estoque_minimo) VALUES ($1,$2,$3,$4) RETURNING id', ['Algodão Hidrófilo','rolo',3,1])).rows[0].id;
    const i4 = (await pool.query('INSERT INTO insumos (nome,unidade_medida,estoque_fisico,estoque_minimo) VALUES ($1,$2,$3,$4) RETURNING id', ['Álcool 70%','frasco',4,2])).rows[0].id;
    const i5 = (await pool.query('INSERT INTO insumos (nome,unidade_medida,estoque_fisico,estoque_minimo) VALUES ($1,$2,$3,$4) RETURNING id', ['Curativo Estéril','unidade',15,5])).rows[0].id;

    const p1 = (await pool.query('INSERT INTO procedimentos (nome,descricao) VALUES ($1,$2) RETURNING id', ['Aplicação de Insulina','Procedimento de aplicação de insulina glargina com seringa'])).rows[0].id;
    const p2 = (await pool.query('INSERT INTO procedimentos (nome,descricao) VALUES ($1,$2) RETURNING id', ['Curativo Simples','Troca de curativo com limpeza antisséptica'])).rows[0].id;

    for (const [pid, iid, qty] of [[p1,i1,1],[p1,i2,2],[p1,i3,0.1],[p1,i4,0.5],[p2,i5,1],[p2,i3,0.2],[p2,i4,0.5]]) {
      await pool.query('INSERT INTO receita_procedimento (procedimento_id,insumo_id,quantidade) VALUES ($1,$2,$3)', [pid,iid,qty]);
    }

    await pool.query('INSERT INTO agendamentos (paciente_nome,data,procedimento_id,status) VALUES ($1,$2,$3,$4)', ['Ana Costa',today,p1,'Realizado']);
    await pool.query('INSERT INTO agendamentos (paciente_nome,data,procedimento_id,status) VALUES ($1,$2,$3,$4)', ['Guilherme Silva',d1,p1,'Confirmado']);
    await pool.query('INSERT INTO agendamentos (paciente_nome,data,procedimento_id,status) VALUES ($1,$2,$3,$4)', ['Maria Oliveira',d2,p2,'Confirmado']);
    await pool.query('INSERT INTO agendamentos (paciente_nome,data,procedimento_id,status) VALUES ($1,$2,$3,$4)', ['João Santos',d3,p1,'Confirmado']);
    await pool.query('INSERT INTO agendamentos (paciente_nome,data,procedimento_id,status) VALUES ($1,$2,$3,$4)', ['Carla Mendes',d6,p2,'Confirmado']);

    console.log('[DB] Dados de exemplo inseridos.');
  }
}

module.exports = { pool, initDB };
