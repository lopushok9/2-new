require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { identifyImageWithINat } = require('./lib/identification');
const stream = require('stream');
const { promisify } = require('util');

// --- CONFIGURATION ---
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not defined! Please add it to your .env file.');
  process.exit(1);
}

// --- BOT INITIALIZATION ---
const bot = new TelegramBot(token, { polling: true });
console.log('Telegram bot is running...');

// --- HELPERS ---
const pipeline = promisify(stream.pipeline);

// --- BOT LOGIC ---

// Listener for the /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const welcomeMessage = `
Welcome to WhatBirdAI Bot! 🐦

I can help you identify birds from a photo. Just send me a picture!
  `;
  bot.sendMessage(chatId, welcomeMessage);
});

// Listener for text messages (that are not commands)
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // If the message is not text (e.g., a photo, sticker), ignore it here.
  // The 'photo' listener will handle photos separately.
  if (!text) {
    return;
  }

  // Ignore commands
  if (text.startsWith('/')) {
    return;
  }

  bot.sendMessage(chatId, `Sorry, I only support photo identification at the moment. Please send me a picture of a bird.`);
});

// Listener for photo messages
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;

  try {
    await bot.sendChatAction(chatId, 'typing');
    
    // Get the file ID of the highest resolution photo
    const photo = msg.photo[msg.photo.length - 1];
    const fileId = photo.file_id;

    // Get a file stream from Telegram
    const fileStream = bot.getFileStream(fileId);

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of fileStream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Call the identification service
    const identificationResult = await identifyImageWithINat(buffer);

    // Send the result back to the user
    await bot.sendMessage(chatId, identificationResult, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('Error during photo identification:', error);
    await bot.sendMessage(chatId, `Sorry, an error occurred while trying to identify the bird. Please try again later.`);
  }
});

// Error handling
bot.on('polling_error', (error) => {
  console.error(`Polling error: ${error.code} - ${error.message}`);
});

module.exports = bot;
