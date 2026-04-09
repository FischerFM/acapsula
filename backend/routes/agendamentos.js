const express = require('express');
const router = express.Router();
const { pool } = require('../database');
const XLSX = require('xlsx');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, p.nome as procedimento_nome
      FROM agendamentos a
      JOIN procedimentos p ON a.procedimento_id = p.id
      ORDER BY a.data DESC, a.id DESC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { paciente_nome, cpf = '', data, procedimento_id, status = 'Confirmado', observacoes = '' } = req.body;
    if (!paciente_nome || !data || !procedimento_id)
      return res.status(400).json({ error: 'paciente_nome, data e procedimento_id são obrigatórios' });

    const { rows: proc } = await pool.query('SELECT id FROM procedimentos WHERE id=$1', [procedimento_id]);
    if (!proc.length) return res.status(404).json({ error: 'Procedimento não encontrado' });

    const { rows: nr } = await pool.query(
      'INSERT INTO agendamentos (paciente_nome,cpf,data,procedimento_id,status,observacoes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [paciente_nome, cpf, data, procedimento_id, status, observacoes]
    );
    const { rows } = await pool.query(`
      SELECT a.*, p.nome as procedimento_nome FROM agendamentos a
      JOIN procedimentos p ON a.procedimento_id = p.id WHERE a.id=$1
    `, [nr[0].id]);
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

    const { rows: procs } = await pool.query('SELECT id, nome FROM procedimentos');
    const procMap = {};
    for (const p of procs) procMap[p.nome.toLowerCase().trim()] = p.id;

    let importados = 0;
    const erros = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const linha = i + 2;
      const norm = {};
      for (const [k, v] of Object.entries(row)) norm[normKey(k)] = v;

      const paciente = String(norm['paciente'] || norm['nome'] || '').trim();
      const dataRaw = norm['data'] || '';
      const procedimentoNome = String(norm['procedimento'] || '').trim();
      const observacoes = String(norm['observacoes'] || norm['observacao'] || norm['obs'] || '').trim();

      if (!paciente || !dataRaw || !procedimentoNome) {
        erros.push(`Linha ${linha}: Paciente, Data e Procedimento são obrigatórios.`); continue;
      }

      let dataISO;
      if (dataRaw instanceof Date) {
        dataISO = dataRaw.toISOString().split('T')[0];
      } else {
        const str = String(dataRaw).trim();
        const matchBR = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (matchBR) {
          dataISO = `${matchBR[3]}-${matchBR[2].padStart(2,'0')}-${matchBR[1].padStart(2,'0')}`;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
          dataISO = str;
        } else {
          erros.push(`Linha ${linha}: Data inválida "${str}". Use DD/MM/AAAA.`); continue;
        }
      }

      const procId = procMap[procedimentoNome.toLowerCase().trim()];
      if (!procId) { erros.push(`Linha ${linha}: Procedimento "${procedimentoNome}" não encontrado.`); continue; }

      try {
        await pool.query(
          'INSERT INTO agendamentos (paciente_nome,data,procedimento_id,status,observacoes) VALUES ($1,$2,$3,$4,$5)',
          [paciente, dataISO, procId, 'Confirmado', observacoes]
        );
        importados++;
      } catch (e) { erros.push(`Linha ${linha}: ${e.message}`); }
    }

    res.json({ importados, erros, total: rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows: ex } = await client.query('SELECT * FROM agendamentos WHERE id=$1', [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Agendamento não encontrado' });
    const ag = ex[0];

    const { paciente_nome, cpf, data, procedimento_id, status, observacoes } = req.body;
    const novoStatus = status ?? ag.status;

    if (novoStatus === 'Realizado' && ag.status !== 'Realizado') {
      const { rows: receita } = await client.query('SELECT * FROM receita_procedimento WHERE procedimento_id=$1', [ag.procedimento_id]);
      const { rows: proc } = await client.query('SELECT nome FROM procedimentos WHERE id=$1', [ag.procedimento_id]);
      await client.query('BEGIN');
      for (const item of receita) {
        await client.query('UPDATE insumos SET estoque_fisico = estoque_fisico - $1 WHERE id=$2', [item.quantidade, item.insumo_id]);
        const { rows: ins } = await client.query('SELECT estoque_fisico FROM insumos WHERE id=$1', [item.insumo_id]);
        await client.query(
          `INSERT INTO movimentacoes_estoque (insumo_id,tipo,quantidade,saldo_apos,observacoes,data) VALUES ($1,'Saída',$2,$3,$4,$5)`,
          [item.insumo_id, item.quantidade, ins[0].estoque_fisico, `${proc[0]?.nome || 'Procedimento'} — ${ag.paciente_nome}`, ag.data]
        );
      }
      await client.query('COMMIT');
    }

    await client.query(`
      UPDATE agendamentos SET paciente_nome=$1,cpf=$2,data=$3,procedimento_id=$4,status=$5,observacoes=$6 WHERE id=$7
    `, [paciente_nome??ag.paciente_nome, cpf??ag.cpf??'', data??ag.data, procedimento_id??ag.procedimento_id, novoStatus, observacoes??ag.observacoes, req.params.id]);

    const { rows } = await client.query(`
      SELECT a.*, p.nome as procedimento_nome FROM agendamentos a
      JOIN procedimentos p ON a.procedimento_id = p.id WHERE a.id=$1
    `, [req.params.id]);
    res.json(rows[0]);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows: ex } = await pool.query('SELECT id FROM agendamentos WHERE id=$1', [req.params.id]);
    if (!ex.length) return res.status(404).json({ error: 'Agendamento não encontrado' });
    await pool.query('DELETE FROM agendamentos WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
