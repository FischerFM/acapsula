const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const XLSX = require('xlsx');

function sendExcel(res, sheets, filename) {
  const wb = XLSX.utils.book_new();
  for (const { name, data } of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), name);
  }
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

router.get('/projecao', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const inicio = req.query.inicio || today;
    const fim = req.query.fim || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const { rows: agsFull } = await pool.query(`
      SELECT a.*, p.nome as procedimento_nome FROM agendamentos a
      JOIN procedimentos p ON a.procedimento_id = p.id
      WHERE a.data >= $1 AND a.data <= $2 AND a.status = 'Confirmado'
      ORDER BY a.data
    `, [inicio, fim]);

    const { rows: insumos } = await pool.query('SELECT * FROM insumos ORDER BY nome');
    const consumo = {};
    for (const ag of agsFull) {
      const { rows: receita } = await pool.query('SELECT insumo_id, quantidade FROM receita_procedimento WHERE procedimento_id=$1', [ag.procedimento_id]);
      for (const item of receita) {
        consumo[item.insumo_id] = (consumo[item.insumo_id] || 0) + item.quantidade;
      }
    }

    const resumoData = insumos.filter(ins => (consumo[ins.id] || 0) > 0).map(ins => ({
      'Insumo': ins.nome, 'Marca': ins.marca || '', 'Unidade': ins.unidade_medida,
      'Estoque Atual': ins.estoque_fisico,
      'Consumo Previsto': Math.round((consumo[ins.id] || 0) * 1000) / 1000,
      'Saldo Final': Math.round((ins.estoque_fisico - (consumo[ins.id] || 0)) * 1000) / 1000,
      'Situacao': ins.estoque_fisico >= (consumo[ins.id] || 0) ? 'OK' : 'INSUFICIENTE',
    }));

    const agData = agsFull.map(ag => ({
      'Data': fmtDate(ag.data), 'Paciente': ag.paciente_nome,
      'Procedimento': ag.procedimento_nome, 'Status': ag.status,
    }));

    sendExcel(res, [{ name: 'Consumo por Insumo', data: resumoData }, { name: 'Agendamentos', data: agData }],
      `projecao_${inicio}_${fim}.xlsx`);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/pedido-compra', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const inicio = req.query.inicio || today;
    const fim = req.query.fim || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const { rows: agsFull } = await pool.query(`
      SELECT a.* FROM agendamentos a
      WHERE a.data >= $1 AND a.data <= $2 AND a.status = 'Confirmado'
    `, [inicio, fim]);

    const { rows: insumos } = await pool.query('SELECT * FROM insumos ORDER BY nome');
    const consumo = {};
    for (const ag of agsFull) {
      const { rows: receita } = await pool.query('SELECT insumo_id, quantidade FROM receita_procedimento WHERE procedimento_id=$1', [ag.procedimento_id]);
      for (const item of receita) {
        consumo[item.insumo_id] = (consumo[item.insumo_id] || 0) + item.quantidade;
      }
    }

    const insuficientes = [];
    for (const ins of insumos) {
      if ((consumo[ins.id] || 0) > 0 && ins.estoque_fisico < (consumo[ins.id] || 0)) {
        const deficit = Math.round(((consumo[ins.id] || 0) - ins.estoque_fisico) * 1000) / 1000;
        const { rows: ult } = await pool.query(`SELECT fornecedor FROM movimentacoes_estoque WHERE insumo_id=$1 AND tipo='Entrada' AND fornecedor!='' ORDER BY data DESC LIMIT 1`, [ins.id]);
        insuficientes.push({
          'Item': ins.nome, 'Marca': ins.marca || '', 'Unidade': ins.unidade_medida,
          'Estoque Atual': ins.estoque_fisico,
          'Consumo Previsto': Math.round((consumo[ins.id] || 0) * 1000) / 1000,
          'Quantidade a Comprar': deficit,
          'Ultimo Fornecedor': ult[0]?.fornecedor || '',
          'Observacoes': '',
        });
      }
    }

    if (insuficientes.length === 0) return res.status(200).json({ message: 'Nenhum insumo insuficiente.' });
    sendExcel(res, [{ name: 'Pedido de Compra', data: insuficientes }], `pedido_compra_${inicio}_${fim}.xlsx`);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/movimentacoes', async (req, res) => {
  try {
    const { insumo_id, tipo, inicio, fim } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (insumo_id) { where += ` AND m.insumo_id = $${params.length+1}`; params.push(insumo_id); }
    if (tipo)      { where += ` AND m.tipo = $${params.length+1}`;       params.push(tipo); }
    if (inicio)    { where += ` AND m.data >= $${params.length+1}`;      params.push(inicio); }
    if (fim)       { where += ` AND m.data <= $${params.length+1}`;      params.push(fim); }

    const { rows: movs } = await pool.query(`
      SELECT m.*, i.nome as insumo_nome, i.unidade_medida, i.marca
      FROM movimentacoes_estoque m JOIN insumos i ON m.insumo_id = i.id
      ${where} ORDER BY m.data DESC, m.id DESC
    `, params);

    const data = movs.map(m => ({
      'Data': fmtDate(m.data), 'Insumo': m.insumo_nome, 'Marca': m.marca || '',
      'Unidade': m.unidade_medida, 'Tipo': m.tipo,
      'Quantidade': m.tipo === 'Saída' ? `-${m.quantidade}` : `+${m.quantidade}`,
      'Saldo Apos': m.saldo_apos, 'Fornecedor': m.fornecedor || '', 'Observacoes': m.observacoes || '',
    }));

    const label = inicio && fim ? `${inicio}_${fim}` : 'completo';
    sendExcel(res, [{ name: 'Movimentacoes', data }], `historico_${label}.xlsx`);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/insumos', async (req, res) => {
  try {
    const { rows: insumos } = await pool.query('SELECT * FROM insumos ORDER BY nome');
    const data = insumos.map(i => ({
      'Item': i.nome, 'Marca': i.marca || '', 'Unidade': i.unidade_medida,
      'Saldo Atual': i.estoque_fisico, 'Estoque Minimo': i.estoque_minimo,
    }));
    sendExcel(res, [{ name: 'Insumos', data }], 'insumos.xlsx');
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
