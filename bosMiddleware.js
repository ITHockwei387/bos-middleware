// bosMiddleware.js - Simple Node.js server to call BOS API
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
app.use(express.json());

// ============================================================
// BOS API CONFIGURATION
// ============================================================
const BOS_CONFIG = {
  BASE_URL: 'https://uw94o7zg99.execute-api.ap-southeast-1.amazonaws.com',
  API_KEY: 'kYREincZNh9ZUAZsk8tiP',
  SECRET: 'XGyzi3O2JIldnV4ugLbGb',
  ORIGIN: 'https://mandarin.club',
  REPORT_ID: '龍巖風水奇門盤.命json',
  IP: '74.220.52.2'
};

// ============================================================
// GENERATE BOS API SIGNATURE
// ============================================================
function generateBOSSignature(timestamp, method, path, ip) {
  const message = `${timestamp}\r\n${method}\r\n${path}\r\n${ip}`;
  const signature = crypto
    .createHmac('sha256', BOS_CONFIG.SECRET)
    .update(message)
    .digest('hex');
  return signature;
}

// ============================================================
// CALL BOS API
// ============================================================
async function callBOSAPI(name, datetime, gender) {
  try {
    const timestamp = Date.now().toString();
    const method = 'POST';
    const path = `/api/report/${BOS_CONFIG.REPORT_ID}`;
    
    const signature = generateBOSSignature(timestamp, method, path, BOS_CONFIG.IP);
    
    console.log('🔐 BOS API Request:');
    console.log('   Timestamp:', timestamp);
    console.log('   Signature:', signature);
    console.log('   Name:', name);
    console.log('   DateTime:', datetime);
    console.log('   Gender:', gender);
    
    const url = BOS_CONFIG.BASE_URL + path;
    const headers = {
      'Timestamp': timestamp,
      'Authorization': `TOKEN ${signature}`,
      'Api-Key': BOS_CONFIG.API_KEY,
      'Origin': BOS_CONFIG.ORIGIN,
      'Content-Type': 'application/json'
    };
    
    const payload = {
      'name_cn': name,
      'datetime': datetime,
      'gender': gender
    };
    
    const response = await axios.post(url, payload, { headers });
    
    console.log('📥 BOS API Response:');
    console.log('   Status:', response.status);
    console.log('   Data:', JSON.stringify(response.data));
    
    return {
      success: true,
      data: response.data
    };
    
  } catch (error) {
    console.error('❌ BOS API Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================
// EXTRACT GOLDEN CARD
// ============================================================
function extractGoldenCard(bosResponse) {
  if (!bosResponse.success) {
    console.log('⚠️ BOS API call failed, using fallback');
    return '离';
  }
  
  try {
    const data = bosResponse.data;
    
    // 尝试多个可能的字段名
    let palace = null;
    
    if (data && data['life']) {
      palace = data['life'];
      console.log('✅ Found palace in "life" field:', palace);
    } else if (data && data['命宫']) {
      palace = data['命宫'];
      console.log('✅ Found palace in "命宫" field:', palace);
    }
    
    if (palace) {
      // 完整支持简体和繁体（八卦所有变体）
      const baguaMap = {
        // 简体
        '震': '震',
        '巽': '巽', 
        '离': '离',
        '坤': '坤',
        '兑': '兑',
        '乾': '乾',
        '坎': '坎',
        '艮': '艮',
        // 繁体
        '離': '离',  // 繁体离
        '兌': '兑',  // 繁体兑
        '乾': '乾',  // 乾简繁相同
        '坤': '坤',  // 坤简繁相同
        '坎': '坎',  // 坎简繁相同
        '艮': '艮',  // 艮简繁相同
        '震': '震',  // 震简繁相同
        '巽': '巽'   // 巽简繁相同
      };
      
      // 检查是否直接匹配
      for (const [key, value] of Object.entries(baguaMap)) {
        if (palace.includes(key)) {
          console.log('✅ Extracted Golden Card:', value);
          return value;
        }
      }
      
      // 如果没有匹配到，尝试去除"宫"字后再匹配
      const palaceWithoutGong = palace.replace('宮', '').replace('宫', '');
      for (const [key, value] of Object.entries(baguaMap)) {
        if (palaceWithoutGong.includes(key)) {
          console.log('✅ Extracted Golden Card (after removing 宫):', value);
          return value;
        }
      }
    }
    
    console.log('⚠️ Could not extract palace, using fallback');
    console.log('   Response data:', JSON.stringify(data));
    return '离';
    
  } catch (error) {
    console.error('❌ Error extracting Golden Card:', error);
    return '离';
  }
}

// ============================================================
// API ENDPOINT
// ============================================================
app.post('/api/calculate_golden_card', async (req, res) => {
  try {
    console.log('\n🎯 Received calculation request');
    console.log('   Order ID:', req.body.shopify_order_id);
    console.log('   Wallets:', req.body.wallets.length);
    
    const wallets = req.body.wallets || [];
    const results = [];
    
    for (const wallet of wallets) {
      console.log(`\n🎴 Processing wallet #${wallet.walletNum}`);
      console.log('   Recipient:', wallet.recipient);
      console.log('   DateTime:', wallet.datetime);
      console.log('   Gender:', wallet.gender);
      
      const bosResponse = await callBOSAPI(
        wallet.name_cn,
        wallet.datetime,
        wallet.gender
      );
      
      const goldenCard = extractGoldenCard(bosResponse);
      console.log('   Result:', goldenCard);
      
      results.push({
        walletNum: wallet.walletNum,
        goldenCard: goldenCard,
        bosResponse: bosResponse.success ? bosResponse.data : null
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n✅ All wallets processed successfully');
    
    res.json({
      success: true,
      results: results
    });
    
  } catch (error) {
    console.error('❌ Error processing request:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/', (req, res) => {
  res.json({
    status: 'running',
    service: 'BOS API Middleware',
    version: '1.0.0'
  });
});

// 检查服务器 IP
app.get('/check-ip', async (req, res) => {
  try {
    const response = await axios.get('https://api.ipify.org?format=json');
    res.json({
      server_ip: response.data.ip,
      message: 'Send this IP to BOS API provider for whitelisting'
    });
  } catch (error) {
    res.json({
      error: error.message,
      message: 'Could not fetch IP'
    });
  }
});

// ============================================================
// START SERVER
// ============================================================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 BOS API Middleware Server`);
  console.log(`   Running on: http://localhost:${PORT}`);
  console.log(`   Endpoint: POST /api/calculate_golden_card`);
  console.log(`\n✅ Server is ready!`);
});



