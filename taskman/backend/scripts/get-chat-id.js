#!/usr/bin/env node

/**
 * Telegram Chat ID Helper
 * 
 * Usage:
 *   node scripts/get-chat-id.js <BOT_TOKEN>
 * 
 * Steps:
 * 1. Create a bot with @BotFather
 * 2. Send a message to your bot
 * 3. Run this script with your bot token
 */

const https = require('https');

const botToken = process.argv[2];

if (!botToken) {
  console.error('❌ Error: Bot token is required');
  console.log('\nUsage:');
  console.log('  node scripts/get-chat-id.js <BOT_TOKEN>');
  console.log('\nExample:');
  console.log('  node scripts/get-chat-id.js 123456789:ABCdefGHIjklMNOpqrsTUVwxyz');
  console.log('\nSteps:');
  console.log('  1. Create a bot with @BotFather in Telegram');
  console.log('  2. Send any message to your bot (e.g., "hello")');
  console.log('  3. Run this script with your bot token');
  process.exit(1);
}

const url = `https://api.telegram.org/bot${botToken}/getUpdates`;

console.log('🔍 Fetching updates from Telegram...\n');

https.get(url, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (!response.ok) {
        console.error('❌ Error:', response.description);
        process.exit(1);
      }
      
      if (response.result.length === 0) {
        console.log('⚠️  No messages found!');
        console.log('\nPlease:');
        console.log('  1. Open Telegram');
        console.log('  2. Find your bot');
        console.log('  3. Send any message to it (e.g., "hello")');
        console.log('  4. Run this script again');
        process.exit(0);
      }
      
      console.log('✅ Found messages!\n');
      
      // Extract unique chat IDs
      const chatIds = new Set();
      response.result.forEach(update => {
        if (update.message && update.message.chat) {
          chatIds.add(update.message.chat.id);
        }
      });
      
      if (chatIds.size === 0) {
        console.log('⚠️  No chat IDs found in messages');
        process.exit(0);
      }
      
      console.log('📋 Your Chat ID(s):\n');
      chatIds.forEach(chatId => {
        console.log(`   ${chatId}`);
      });
      
      console.log('\n📝 Add this to your .env file:');
      console.log(`\nTELEGRAM_BOT_TOKEN=${botToken}`);
      console.log(`TELEGRAM_CHAT_ID=${Array.from(chatIds)[0]}`);
      
      // Show recent messages
      console.log('\n💬 Recent messages:');
      response.result.slice(-3).forEach(update => {
        if (update.message) {
          const msg = update.message;
          const from = msg.from.first_name || msg.from.username || 'Unknown';
          const text = msg.text || '(no text)';
          console.log(`   ${from}: ${text}`);
        }
      });
      
    } catch (error) {
      console.error('❌ Error parsing response:', error.message);
      process.exit(1);
    }
  });
}).on('error', (error) => {
  console.error('❌ Network error:', error.message);
  process.exit(1);
});
