#!/usr/bin/env node

/**
 * Script to help fix Brevo IP authorization issues
 * Run this script to get your current IP and instructions
 */

const https = require('https');

console.log('🔧 Brevo IP Authorization Fix Helper');
console.log('=====================================\n');

// Get current IP address
function getCurrentIP() {
  return new Promise((resolve, reject) => {
    https.get('https://api.ipify.org?format=json', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const ipData = JSON.parse(data);
          resolve(ipData.ip);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  try {
    console.log('📡 Getting your current IP address...');
    const currentIP = await getCurrentIP();
    
    console.log(`✅ Your current IP address: ${currentIP}`);
    console.log('\n🔐 To fix the Brevo IP authorization issue:');
    console.log('============================================');
    console.log('1. Go to: https://app.brevo.com/security/authorised_ips');
    console.log('2. Sign in to your Brevo account');
    console.log('3. Click "Add IP Address"');
    console.log(`4. Enter your IP: ${currentIP}`);
    console.log('5. Give it a description (e.g., "Development Server")');
    console.log('6. Click "Add"');
    console.log('\n⏳ Wait 2-3 minutes for the changes to take effect');
    console.log('\n🔄 Then restart your Node.js server');
    
    console.log('\n📝 Alternative solutions:');
    console.log('=======================');
    console.log('1. Use a static IP address for your server');
    console.log('2. Add your IP range instead of a single IP');
    console.log('3. Temporarily disable IP restrictions in Brevo (not recommended for production)');
    
    console.log('\n🧪 For development/testing:');
    console.log('==========================');
    console.log('Add this to your .env file:');
    console.log('NODE_ENV=development');
    console.log('\nThis will enable mock email mode that shows OTP in console');
    
  } catch (error) {
    console.error('❌ Error getting IP address:', error.message);
    console.log('\n🔧 Manual steps:');
    console.log('1. Visit https://whatismyipaddress.com/');
    console.log('2. Copy your IP address');
    console.log('3. Follow the steps above to add it to Brevo');
  }
}

main(); 