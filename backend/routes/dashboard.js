const express = require('express');
const router = express.Router();
const { pool } = require('../database');

router.get('/resumo', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const em7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const [r1, r2, r3, r4] = await Promise.all([
      pool.query('SELECT COUNT(*) as c FROM insumos'),
      pool.query("SELECT COUNT(*) as c FROM agendamentos WHERE data=$1 AND status='Confirmado'", [today]),
      pool.query("SELECT COUNT(*) as c FROM agendamentos WHERE data>=$1 AND data<=$2 AND status='Confirmado'", [today, em7]),
      pool.query('SELECT COUNT(*) as c FROM insumos WHERE estoque_minimo>0 AND estoque_fisico<=estoque_minimo'),
    ]);

    res.json({
      total_insumos: parseInt(r1.rows[0].c),
      agendamentos_hoje: parseInt(r2.rows[0].c),
      agendamentos_semana: parseInt(r3.rows[0].c),
      insumos_abaixo_minimo: parseInt(r4.rows[0].c),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/projecao', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { rows: agendamentos } = await pool.query(`
      SELECT a.id, a.data, a.paciente_nome, a.procedimento_id, p.nome as procedimento_nome
      FROM agendamentos a JOIN procedimentos p ON a.procedimento_id = p.id
      WHERE a.data >= $1 AND a.status = 'Confirmado'
      ORDER BY a.data
    `, [today]);

    const { rows: insumos } = await pool.query('SELECT * FROM insumos ORDER BY nome');

    if (agendamentos.length === 0) return res.json({ projecao: [], insumos, alertas: [] });

    const consumoPorDia = {}, agsPorDia = {};
    for (const ag of agendamentos) {
      const { rows: receita } = await pool.query('SELECT insumo_id, quantidade FROM receita_procedimento WHERE procedimento_id=$1', [ag.procedimento_id]);
      if (!consumoPorDia[ag.data]) consumoPorDia[ag.data] = {};
      if (!agsPorDia[ag.data]) agsPorDia[ag.data] = [];
      agsPorDia[ag.data].push({ id: ag.id, paciente: ag.paciente_nome, procedimento: ag.procedimento_nome });
      for (const item of receita) {
        consumoPorDia[ag.data][item.insumo_id] = (consumoPorDia[ag.data][item.insumo_id] || 0) + item.quantidade;
      }
    }

    const saldo = {};
    for (const ins of insumos) saldo[ins.id] = ins.estoque_fisico;

    const dias = Object.keys(consumoPorDia).sort();
    const projecao = [];
    for (const dia of dias) {
      const consumos = consumoPorDia[dia];
      const snapshot = {};
      for (const ins of insumos) {
        const consumo = consumos[ins.id] || 0;
        saldo[ins.id] -= consumo;
        snapshot[ins.id] = { consumo, saldo: Math.round(saldo[ins.id] * 1000) / 1000 };
      }
      projecao.push({ data: dia, agendamentos: agsPorDia[dia], estoque: snapshot });
    }

    const alertasPorInsumo = new Set(), alertas = [];
    for (const dia of projecao) {
      for (const ins of insumos) {
        const info = dia.estoque[ins.id];
        if (!alertasPorInsumo.has(ins.id) && info.saldo < 0) {
          alertas.push({ tipo: 'critico', insumo_id: ins.id, insumo: ins.nome, unidade: ins.unidade_medida, data_critica: dia.data, deficit: Math.round(Math.abs(info.saldo) * 1000) / 1000 });
          alertasPorInsumo.add(ins.id);
        }
      }
    }
    for (const ins of insumos) {
      if (!alertasPorInsumo.has(ins.id) && ins.estoque_minimo > 0 && ins.estoque_fisico <= ins.estoque_minimo) {
        alertas.push({ tipo: 'atencao', insumo_id: ins.id, insumo: ins.nome, unidade: ins.unidade_medida, mensagem: `Estoque atual (${ins.estoque_fisico} ${ins.unidade_medida}) ≤ mínimo (${ins.estoque_minimo})` });
        alertasPorInsumo.add(ins.id);
      }
    }

    res.json({ projecao, insumos, alertas });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/validades', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const em30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const { rows: lotes } = await pool.query(`
      SELECT m.id, m.lote, m.data_validade, m.quantidade, m.data as data_entrada,
             i.nome as insumo_nome, i.unidade_medida, i.marca
      FROM movimentacoes_estoque m JOIN insumos i ON m.insumo_id = i.id
      WHERE m.tipo = 'Entrada' AND m.data_validade != '' AND m.data_validade IS NOT NULL
        AND m.data_validade <= $1
      ORDER BY m.data_validade ASC
    `, [em30]);
    res.json({
      vencidos: lotes.filter(l => l.data_validade < today),
      vencendo: lotes.filter(l => l.data_validade >= today),
      total: lotes.length,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/graficos', async (req, res) => {
  try {
    const [r1, r2, r3, r4] = await Promise.all([
      pool.query(`
        SELECT to_char(data::date, 'YYYY-MM') as mes, insumo_id, SUM(quantidade) as total
        FROM movimentacoes_estoque
        WHERE tipo = 'Saída' AND data::date >= NOW() - INTERVAL '6 months'
        GROUP BY mes, insumo_id ORDER BY mes
      `),
      pool.query(`
        SELECT p.nome, COUNT(*) as total
        FROM agendamentos a JOIN procedimentos p ON a.procedimento_id = p.id
        WHERE a.status = 'Realizado' AND a.data::date >= NOW() - INTERVAL '90 days'
        GROUP BY a.procedimento_id, p.nome ORDER BY total DESC LIMIT 8
      `),
      pool.query('SELECT nome, estoque_fisico, estoque_minimo, unidade_medida FROM insumos ORDER BY estoque_fisico ASC LIMIT 10'),
      pool.query(`
        SELECT to_char(data::date, 'YYYY-MM') as mes,
               SUM(CASE WHEN tipo = 'Entrada' THEN quantidade ELSE 0 END) as entradas,
               SUM(CASE WHEN tipo = 'Saída' THEN quantidade ELSE 0 END) as saidas
        FROM movimentacoes_estoque
        WHERE data::date >= NOW() - INTERVAL '6 months'
        GROUP BY mes ORDER BY mes
      `),
    ]);

    const { rows: insumos } = await pool.query('SELECT id, nome FROM insumos');
    const insumoMap = {};
    for (const i of insumos) insumoMap[i.id] = i.nome;

    res.json({
      consumoMensal: r1.rows,
      topProcedimentos: r2.rows,
      estoqueAtual: r3.rows,
      fluxoMensal: r4.rows,
      insumoMap,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/semana', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const inicio = req.query.inicio || today;
    const fim = req.query.fim || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const { rows: agendamentos } = await pool.query(`
      SELECT a.id, a.data, a.paciente_nome, a.procedimento_id, p.nome as procedimento_nome
      FROM agendamentos a JOIN procedimentos p ON a.procedimento_id = p.id
      WHERE a.data >= $1 AND a.data <= $2 AND a.status = 'Confirmado'
      ORDER BY a.data
    `, [inicio, fim]);

    const { rows: insumos } = await pool.query('SELECT * FROM insumos ORDER BY nome');

    const consumo = {};
    for (const ag of agendamentos) {
      const { rows: receita } = await pool.query('SELECT insumo_id, quantidade FROM receita_procedimento WHERE procedimento_id=$1', [ag.procedimento_id]);
      for (const item of receita) {
        consumo[item.insumo_id] = (consumo[item.insumo_id] || 0) + item.quantidade;
      }
    }

    const resumo = insumos
      .map(ins => ({
        id: ins.id, nome: ins.nome, unidade_medida: ins.unidade_medida,
        estoque_atual: ins.estoque_fisico, estoque_minimo: ins.estoque_minimo,
        consumo_previsto: Math.round((consumo[ins.id] || 0) * 1000) / 1000,
        saldo_final: Math.round((ins.estoque_fisico - (consumo[ins.id] || 0)) * 1000) / 1000,
        suficiente: ins.estoque_fisico >= (consumo[ins.id] || 0),
      }))
      .filter(ins => ins.consumo_previsto > 0);

    res.json({
      periodo: { inicio, fim },
      total_agendamentos: agendamentos.length,
      agendamentos,
      resumo,
      insuficientes: resumo.filter(i => !i.suficiente).length,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
