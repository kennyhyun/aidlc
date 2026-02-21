require('dotenv').config();
const { App } = require('@slack/bolt');

async function debugSlack() {
  console.log('=== Slack Bot Debug ===\n');
  
  // 1. 환경 변수 확인
  console.log('1. Environment Variables:');
  console.log('   BOT_TOKEN:', process.env.SLACK_BOT_TOKEN ? 
    process.env.SLACK_BOT_TOKEN.substring(0, 15) + '...' : '❌ MISSING');
  console.log('   APP_TOKEN:', process.env.SLACK_APP_TOKEN ? 
    process.env.SLACK_APP_TOKEN.substring(0, 15) + '...' : '❌ MISSING');
  console.log('   CHANNEL_ID:', process.env.SLACK_CHANNEL_ID || '❌ MISSING');
  console.log();

  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_APP_TOKEN) {
    console.error('❌ Missing required tokens!');
    process.exit(1);
  }

  // 2. 앱 초기화
  console.log('2. Initializing Slack app...');
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN,
    logLevel: 'DEBUG'  // 상세 로그
  });

  // 3. 이벤트 리스너 등록
  console.log('3. Registering event listeners...');
  
  // 모든 메시지 수신
  app.message(async ({ message, say, client }) => {
    console.log('\n📨 Message received:');
    console.log('   Channel:', message.channel);
    console.log('   User:', message.user);
    console.log('   Text:', message.text);
    console.log('   Type:', message.channel_type);
    
    try {
      await say(`✅ Received: "${message.text}"`);
      console.log('   ✅ Reply sent');
    } catch (error) {
      console.error('   ❌ Reply failed:', error.message);
    }
  });

  // DM 전용 리스너
  app.event('message', async ({ event, say }) => {
    if (event.channel_type === 'im') {
      console.log('\n💬 DM detected:', event.text);
    }
  });

  // 4. 앱 시작
  console.log('4. Starting bot...');
  try {
    await app.start();
    console.log('✅ Bot started successfully!\n');
    console.log('📝 Test instructions:');
    console.log('   1. Go to Slack');
    console.log('   2. Find your bot in Apps');
    console.log('   3. Send a DM: "hello"');
    console.log('   4. Watch this console for logs\n');
    
    // 5. 테스트 메시지 전송 (선택적)
    if (process.env.SLACK_CHANNEL_ID) {
      console.log('5. Sending test message...');
      try {
        const result = await app.client.chat.postMessage({
          channel: process.env.SLACK_CHANNEL_ID,
          text: '🧪 Test message from bot'
        });
        console.log('✅ Test message sent to:', result.channel);
      } catch (error) {
        console.error('❌ Failed to send test message:', error.message);
        console.log('   Tip: Check if SLACK_CHANNEL_ID is correct');
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to start bot:', error.message);
    process.exit(1);
  }
}

debugSlack().catch(console.error);
