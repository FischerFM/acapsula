const express = require('express');
const router = express.Router();
const { pool } = require('../database');

router.get('/procedimento/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT r.id, r.insumo_id, r.quantidade, i.nome as insumo_nome, i.unidade_medida
      FROM receita_procedimento r
      JOIN insumos i ON r.insumo_id = i.id
      WHERE r.procedimento_id = $1
      ORDER BY i.nome
    `, [req.params.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/procedimento/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows: ex } = await client.query('SELECT id FROM procedimentos WHERE id=$1', [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Procedimento não encontrado' });

    const { items = [] } = req.body;
    await client.query('BEGIN');
    await client.query('DELETE FROM receita_procedimento WHERE procedimento_id=$1', [req.params.id]);
    for (const item of items) {
      if (item.insumo_id && item.quantidade > 0) {
        await client.query(
          'INSERT INTO receita_procedimento (procedimento_id,insumo_id,quantidade) VALUES ($1,$2,$3)',
          [req.params.id, item.insumo_id, item.quantidade]
        );
      }
    }
    await client.query('COMMIT');

    const { rows } = await client.query(`
      SELECT r.id, r.insumo_id, r.quantidade, i.nome as insumo_nome, i.unidade_medida
      FROM receita_procedimento r
      JOIN insumos i ON r.insumo_id = i.id
      WHERE r.procedimento_id = $1 ORDER BY i.nome
    `, [req.params.id]);
    res.json(rows);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

module.exports = router;
