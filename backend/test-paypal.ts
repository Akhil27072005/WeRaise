import { testPayPalConnection } from './utils/paypal';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function runTest() {
  console.log('Testing PayPal API connection...');
  console.log('Environment:', process.env.PAYPAL_ENVIRONMENT || 'sandbox');
  console.log('Client ID:', process.env.PAYPAL_CLIENT_ID ? 'Set' : 'Not set');
  console.log('Client Secret:', process.env.PAYPAL_CLIENT_SECRET ? 'Set' : 'Not set');
  
  try {
    const isConnected = await testPayPalConnection();
    
    if (isConnected) {
      console.log('✅ PayPal API connection successful!');
    } else {
      console.log('❌ PayPal API connection failed!');
    }
  } catch (error) {
    console.error('❌ PayPal API connection error:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// Run the test
runTest();
