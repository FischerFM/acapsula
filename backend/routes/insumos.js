const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const XLSX = require('xlsx');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM insumos ORDER BY nome');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { nome, unidade_medida, marca = '', estoque_fisico = 0, estoque_minimo = 0 } = req.body;
    if (!nome || !unidade_medida) return res.status(400).json({ error: 'nome e unidade_medida são obrigatórios' });
    const { rows } = await pool.query(
      'INSERT INTO insumos (nome,unidade_medida,marca,estoque_fisico,estoque_minimo) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [nome, unidade_medida, marca, estoque_fisico, estoque_minimo]
    );
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/importar', upload.single('arquivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (rows.length === 0) return res.status(400).json({ error: 'Planilha vazia.' });

    function normKey(str) {
      return String(str).toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    let criados = 0, atualizados = 0;
    const erros = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const linha = i + 2;
      const norm = {};
      for (const [k, v] of Object.entries(row)) norm[normKey(k)] = v;

      const nome = String(norm['item'] || norm['nome'] || norm['insumo'] || '').trim();
      const unidade = String(norm['unidade'] || norm['unidade_medida'] || norm['un'] || '').trim();
      const marca = String(norm['marca'] || norm['fabricante'] || '').trim();
      const saldo = parseFloat(norm['saldo'] || norm['saldo atual'] || norm['estoque'] || norm['quantidade'] || 0);

      if (!nome) { erros.push(`Linha ${linha}: Nome é obrigatório.`); continue; }
      if (!unidade) { erros.push(`Linha ${linha}: Unidade é obrigatória.`); continue; }

      try {
        const { rows: ex } = await pool.query('SELECT * FROM insumos WHERE LOWER(TRIM(nome)) = LOWER(TRIM($1))', [nome]);
        const today = new Date().toISOString().split('T')[0];
        if (ex.length > 0) {
          await pool.query('UPDATE insumos SET unidade_medida=$1, marca=$2, estoque_fisico=$3 WHERE id=$4', [unidade, marca, isNaN(saldo) ? ex[0].estoque_fisico : saldo, ex[0].id]);
          await pool.query(`INSERT INTO movimentacoes_estoque (insumo_id,tipo,quantidade,saldo_apos,observacoes,data) VALUES ($1,'Ajuste',$2,$3,'Importação via planilha',$4)`, [ex[0].id, saldo, saldo, today]);
          atualizados++;
        } else {
          const { rows: nr } = await pool.query('INSERT INTO insumos (nome,unidade_medida,marca,estoque_fisico,estoque_minimo) VALUES ($1,$2,$3,$4,0) RETURNING id', [nome, unidade, marca, isNaN(saldo) ? 0 : saldo]);
          await pool.query(`INSERT INTO movimentacoes_estoque (insumo_id,tipo,quantidade,saldo_apos,observacoes,data) VALUES ($1,'Entrada',$2,$3,'Importação via planilha',$4)`, [nr[0].id, saldo, saldo, today]);
          criados++;
        }
      } catch (e) { erros.push(`Linha ${linha}: ${e.message}`); }
    }

    res.json({ criados, atualizados, erros, total: rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { rows: ex } = await pool.query('SELECT * FROM insumos WHERE id=$1', [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Insumo não encontrado' });
    const ins = ex[0];
    const { nome, unidade_medida, marca, estoque_fisico, estoque_minimo } = req.body;
    const { rows } = await pool.query(
      'UPDATE insumos SET nome=$1,unidade_medida=$2,marca=$3,estoque_fisico=$4,estoque_minimo=$5 WHERE id=$6 RETURNING *',
      [nome??ins.nome, unidade_medida??ins.unidade_medida, marca??ins.marca, estoque_fisico??ins.estoque_fisico, estoque_minimo??ins.estoque_minimo, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows: ex } = await pool.query('SELECT id FROM insumos WHERE id=$1', [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Insumo não encontrado' });
    const { rows: em } = await pool.query('SELECT COUNT(*) as c FROM receita_procedimento WHERE insumo_id=$1', [req.params.id]);
    if (parseInt(em[0].c) > 0) return res.status(409).json({ error: 'Insumo está em uso em receitas. Remova-o das receitas primeiro.' });
    await pool.query('DELETE FROM insumos WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
