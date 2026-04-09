const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'acapsula_secret_key';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    if (!usuario || !senha) return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });

    const { rows } = await pool.query('SELECT * FROM usuarios WHERE usuario = $1', [usuario.trim()]);
    if (rows.length === 0) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });

    const user = rows[0];
    const ok = await bcrypt.compare(senha, user.senha_hash);
    if (!ok) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });

    const token = jwt.sign({ id: user.id, usuario: user.usuario }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, usuario: user.usuario });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
