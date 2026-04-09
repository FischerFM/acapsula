const express = require('express');
const router = express.Router();
const { pool } = require('../database');

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
