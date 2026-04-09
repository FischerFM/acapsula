const express = require('express');
const router = express.Router();
const { pool } = require('../database');

router.get('/', async (req, res) => {
  try {
    const { insumo_id, tipo, inicio, fim } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (insumo_id) { where += ` AND m.insumo_id = $${params.length+1}`; params.push(insumo_id); }
    if (tipo)      { where += ` AND m.tipo = $${params.length+1}`;       params.push(tipo); }
    if (inicio)    { where += ` AND m.data >= $${params.length+1}`;      params.push(inicio); }
    if (fim)       { where += ` AND m.data <= $${params.length+1}`;      params.push(fim); }

    const { rows } = await pool.query(`
      SELECT m.*, i.nome as insumo_nome, i.unidade_medida, i.marca
      FROM movimentacoes_estoque m
      JOIN insumos i ON m.insumo_id = i.id
      ${where}
      ORDER BY m.data DESC, m.id DESC
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/insumo/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT m.*, i.nome as insumo_nome, i.unidade_medida
      FROM movimentacoes_estoque m
      JOIN insumos i ON m.insumo_id = i.id
      WHERE m.insumo_id = $1
      ORDER BY m.data DESC, m.id DESC
    `, [req.params.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const { insumo_id, quantidade, fornecedor = '', observacoes = '', data, lote = '', data_validade = '' } = req.body;
    if (!insumo_id || !quantidade || Number(quantidade) <= 0)
      return res.status(400).json({ error: 'insumo_id e quantidade (> 0) são obrigatórios.' });

    const { rows: ex } = await client.query('SELECT * FROM insumos WHERE id=$1', [insumo_id]);
    if (!ex.length) return res.status(404).json({ error: 'Insumo não encontrado.' });

    const dataRegistro = data || new Date().toISOString().split('T')[0];
    const novoSaldo = ex[0].estoque_fisico + Number(quantidade);

    await client.query('BEGIN');
    await client.query('UPDATE insumos SET estoque_fisico=$1 WHERE id=$2', [novoSaldo, insumo_id]);
    await client.query(
      `INSERT INTO movimentacoes_estoque (insumo_id,tipo,quantidade,saldo_apos,fornecedor,observacoes,data,lote,data_validade)
       VALUES ($1,'Entrada',$2,$3,$4,$5,$6,$7,$8)`,
      [insumo_id, Number(quantidade), novoSaldo, fornecedor, observacoes, dataRegistro, lote, data_validade]
    );
    await client.query('COMMIT');

    res.status(201).json({ success: true, novo_estoque: novoSaldo });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

module.exports = router;
