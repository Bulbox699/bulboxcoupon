// Bot Telegram pour validation manuelle des coupons
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const TOKEN = '8330769234:AAGiGPXFAl13nE7rR44v6MlKhAiuS6sznZM';
const GROUP_ID = -5214080706; // Remplacez par votre group ID
const API_URL = 'https://VOTRE-API-URL/api/validate'; // À remplacer par l'URL de votre backend (Render, Vercel...)

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
  bot.sendMessage(GROUP_ID, `Coupon à valider\nType: ${type}\nCode: ${code}`, opts);
});

// Quand un admin clique sur OUI/NON
bot.on('callback_query', async (query) => {
  const [result, requestId] = query.data.split('|');
  // Appelez l'API pour enregistrer la validation
  try {
    await axios.post(API_URL, { requestId, result });
    bot.answerCallbackQuery(query.id, { text: `Réponse enregistrée: ${result}` });
    bot.editMessageText(`Coupon ${requestId} validé: ${result === 'OUI' ? '✅ OUI' : '❌ NON'}`, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id
    });
  } catch (e) {
    bot.answerCallbackQuery(query.id, { text: 'Erreur API' });
  }
});

// Pour test manuel : /coupon PCS|ABCD123456|requestid123
