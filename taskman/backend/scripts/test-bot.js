#!/usr/bin/env node

/**
 * Simple test bot to get Chat ID
 * 
 * Usage:
 *   TELEGRAM_BOT_TOKEN=your_token node scripts/test-bot.js
 */

const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN || process.argv[2];

if (!token) {
  console.error('❌ Error: Bot token is required');
  console.log('\nUsage:');
  console.log('  TELEGRAM_BOT_TOKEN=your_token node scripts/test-bot.js');
  console.log('  or');
  console.log('  node scripts/test-bot.js your_token');
  process.exit(1);
}

console.log('🤖 Starting bot...');
console.log('📱 Send any message to your bot now!\n');

const bot = new TelegramBot(token, { polling: true });

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const from = msg.from.first_name || msg.from.username || 'Unknown';
  const text = msg.text || '(no text)';
  
  console.log('\n✅ Message received!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`👤 From: ${from}`);
  console.log(`💬 Message: ${text}`);
  console.log(`🆔 Chat ID: ${chatId}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('📝 Add this to your .env file:');
  console.log(`\nTELEGRAM_BOT_TOKEN=${token}`);
  console.log(`TELEGRAM_CHAT_ID=${chatId}\n`);
  
  // Send confirmation
  bot.sendMessage(chatId, `✅ Chat ID received: ${chatId}\n\nYou can now use this bot!`);
  
  console.log('✨ You can press Ctrl+C to stop the bot\n');
});

bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error.message);
});

console.log('⏳ Waiting for messages... (Press Ctrl+C to stop)');
