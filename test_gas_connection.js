// Test script to verify GAS connection works
// Run this in browser console to test the connection

async function testGasConnection() {
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbxs1-Dj0_GsOv5Z7a5Ccg08g87V_2iCiamk8AEbFz5f-AkjbK-XPZmgJezmT3Uw5cWX/exec';

  console.log('🧪 Testing GAS Connection...');

  try {
    // Test 1: Basic connectivity
    console.log('1️⃣ Testing basic connectivity...');
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      mode: 'cors',
      body: JSON.stringify({ action: 'readAll' }),
    });

    console.log('✅ Response received:', response.status, response.statusText);

    // Check headers
    console.log('📋 Response headers:');
    for (let [key, value] of response.headers.entries()) {
      if (key.toLowerCase().includes('access-control') ||
          key.toLowerCase().includes('content-type')) {
        console.log(`   ${key}: ${value}`);
      }
    }

    // Test 2: Parse response
    console.log('2️⃣ Testing response parsing...');
    const result = await response.json();
    console.log('✅ Response parsed successfully:', result);

    // Test 3: Check for CSP violations
    console.log('3️⃣ Checking for CSP violations...');
    // If we get here without CSP errors in console, it's working
    console.log('✅ No CSP violations detected');

    return { success: true, result };

  } catch (error) {
    console.error('❌ Connection test failed:', error);
    return { success: false, error: error.message };
  }
}

// Run the test
testGasConnection().then(result => {
  if (result.success) {
    console.log('🎉 GAS connection test PASSED!');
  } else {
    console.log('💥 GAS connection test FAILED!');
  }
});

// Also test the actual API functions
console.log('🔄 Testing actual API functions...');
import('./services/api.js').then(async (api) => {
  try {
    console.log('Testing fetchAllCases...');
    const result = await api.fetchAllCases();
    console.log('fetchAllCases result:', result);
  } catch (error) {
    console.error('fetchAllCases failed:', error);
  }
}).catch(error => {
  console.error('Failed to import API:', error);
});