const express = require('express');
const cors = require('cors');
const { initDB } = require('./database');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/insumos', require('./routes/insumos'));
app.use('/api/procedimentos', require('./routes/procedimentos'));
app.use('/api/receitas', require('./routes/receitas'));
app.use('/api/agendamentos', require('./routes/agendamentos'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/movimentacoes', require('./routes/movimentacoes'));
app.use('/api/exportar', require('./routes/exportar'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

const PORT = process.env.PORT || 3001;

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`aCAPSULA Backend rodando na porta ${PORT}`);
    });
  })
  .catch(e => {
    console.error('Erro ao inicializar banco:', e.message);
    process.exit(1);
  });
