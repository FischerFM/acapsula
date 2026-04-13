const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const XLSX = require('xlsx');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, COUNT(r.id) as total_insumos
      FROM procedimentos p
      LEFT JOIN receita_procedimento r ON r.procedimento_id = p.id
      GROUP BY p.id ORDER BY p.nome
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { nome, descricao = '' } = req.body;
    if (!nome) return res.status(400).json({ error: 'nome é obrigatório' });
    const { rows } = await pool.query('INSERT INTO procedimentos (nome,descricao) VALUES ($1,$2) RETURNING *', [nome, descricao]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { rows: ex } = await pool.query('SELECT * FROM procedimentos WHERE id=$1', [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Procedimento não encontrado' });
    const proc = ex[0];
    const { nome, descricao } = req.body;
    const { rows } = await pool.query(
      'UPDATE procedimentos SET nome=$1,descricao=$2 WHERE id=$3 RETURNING *',
      [nome??proc.nome, descricao??proc.descricao, req.params.id]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/importar', upload.single('arquivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
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

      const nome = String(norm['nome'] || '').trim();
      const descricao = String(norm['descricao'] || norm['descrição'] || norm['descricao'] || '').trim();

      if (!nome) { erros.push(`Linha ${linha}: Nome é obrigatório.`); continue; }

      try {
        const { rows: ex } = await pool.query('SELECT id FROM procedimentos WHERE LOWER(nome)=LOWER($1)', [nome]);
        if (ex.length > 0) {
          await pool.query('UPDATE procedimentos SET descricao=$1 WHERE id=$2', [descricao, ex[0].id]);
          atualizados++;
        } else {
          await pool.query('INSERT INTO procedimentos (nome,descricao) VALUES ($1,$2)', [nome, descricao]);
          criados++;
        }
      } catch (e) { erros.push(`Linha ${linha}: ${e.message}`); }
    }

    res.json({ criados, atualizados, erros, total: rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows: ex } = await pool.query('SELECT id FROM procedimentos WHERE id=$1', [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Procedimento não encontrado' });
    const { rows: em } = await pool.query('SELECT COUNT(*) as c FROM agendamentos WHERE procedimento_id=$1', [req.params.id]);
    if (parseInt(em[0].c) > 0) return res.status(409).json({ error: 'Procedimento possui agendamentos vinculados. Cancele os agendamentos primeiro.' });
    await pool.query('DELETE FROM procedimentos WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
