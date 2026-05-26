const express = require('express');
const router = express.Router();
const { pool } = require('../database');

router.get('/', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { insumo_id, status } = req.query;

    let where = `m.tipo = 'Entrada' AND m.data_validade != '' AND m.data_validade IS NOT NULL`;
    const params = [];

    if (insumo_id) { where += ` AND m.insumo_id = $${params.length + 1}`; params.push(insumo_id); }

    const { rows } = await pool.query(`
      SELECT m.id, m.lote, m.data_validade, m.quantidade, m.data as data_entrada,
             m.fornecedor, m.observacoes,
             i.id as insumo_id, i.nome as insumo_nome, i.unidade_medida, i.marca
      FROM movimentacoes_estoque m
      JOIN insumos i ON m.insumo_id = i.id
      WHERE ${where}
      ORDER BY m.data_validade ASC
    `, params);

    const lotes = rows.map(l => ({
      ...l,
      status: l.data_validade < today ? 'vencido'
             : l.data_validade <= new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] ? 'vencendo'
             : 'ok',
    }));

    const filtrados = status ? lotes.filter(l => l.status === status) : lotes;
    res.json(filtrados);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
