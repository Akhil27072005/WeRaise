import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// PayPal configuration
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_ENVIRONMENT = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
const PAYPAL_BASE_URL = PAYPAL_ENVIRONMENT === 'live' 
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  throw new Error('PayPal credentials not found. Please set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env');
}

/**
 * Generate PayPal access token
 */
async function generateAccessToken(): Promise<string> {
  const response = await fetch(PAYPAL_BASE_URL + '/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const errorData = await response.json() as { error_description?: string };
    console.error('PayPal token generation failed:', errorData);
    throw new Error(`PayPal token generation failed: ${errorData.error_description || 'Unknown error'}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

/**
 * Create PayPal order for pledge payment
 */
export async function createPledgeOrder(pledgeData: {
  amount: number;
  currency: string;
  campaignTitle: string;
  pledgeId: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ orderId: string; approvalUrl: string }> {
  try {
    const accessToken = await generateAccessToken();

    // Validate input data
    if (!pledgeData.amount || pledgeData.amount <= 0) {
      throw new Error('Invalid amount: amount must be greater than 0');
    }
    if (!pledgeData.currency) {
      throw new Error('Currency is required');
    }
    if (!pledgeData.returnUrl || !pledgeData.cancelUrl) {
      throw new Error('Return and cancel URLs are required');
    }

    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          items: [
            {
              name: `Pledge for ${pledgeData.campaignTitle}`,
              description: `Supporting ${pledgeData.campaignTitle}`,
              quantity: 1,
              unit_amount: {
                currency_code: pledgeData.currency,
                value: pledgeData.amount.toFixed(2)
              }
            }
          ],
          amount: {
            currency_code: pledgeData.currency,
            value: pledgeData.amount.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: pledgeData.currency,
                value: pledgeData.amount.toFixed(2)
              }
            }
          }
        }
      ],
      application_context: {
        return_url: pledgeData.returnUrl,
        cancel_url: pledgeData.cancelUrl,
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        brand_name: 'WeRaise'
      }
    };

    console.log('Creating PayPal order with data:', JSON.stringify(orderData, null, 2));

    const response = await fetch(PAYPAL_BASE_URL + '/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken
      },
      body: JSON.stringify(orderData)
    });

    if (!response.ok) {
      const errorData = await response.json() as { message?: string; details?: any };
      console.error('PayPal order creation failed:', errorData);
      throw new Error(`PayPal order creation failed: ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json() as { 
      id: string; 
      links: Array<{ rel: string; href: string }>;
      status?: string;
    };

    console.log('PayPal order created successfully:', data);

    // Validate response
    if (!data.id) {
      throw new Error('PayPal order creation failed: No order ID returned');
    }

    const approvalLink = data.links.find((link) => link.rel === 'approve');
    if (!approvalLink) {
      throw new Error('PayPal order creation failed: No approval URL returned');
    }
    
    // Return both order ID and approval URL
    return {
      orderId: data.id,
      approvalUrl: approvalLink.href
    };
  } catch (error: any) {
    console.error('Error in createPledgeOrder:', error);
    throw error;
  }
}

/**
 * Capture PayPal payment
 */
export async function capturePayment(orderId: string): Promise<any> {
  try {
    const accessToken = await generateAccessToken();

    const response = await fetch(PAYPAL_BASE_URL + `/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken
      }
    });

    if (!response.ok) {
      const errorData = await response.json() as { message?: string };
      console.error('PayPal payment capture failed:', errorData);
      throw new Error(`PayPal payment capture failed: ${errorData.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('PayPal payment captured successfully:', data);
    return data;
  } catch (error: any) {
    console.error('Error in capturePayment:', error);
    throw error;
  }
}

/**
 * Test PayPal connection
 */
export async function testPayPalConnection(): Promise<boolean> {
  try {
    const accessToken = await generateAccessToken();
    console.log('PayPal access token generated successfully');
    
    // Test creating a simple order to verify everything works
    const testOrderData = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: 'USD',
            value: '1.00'
          },
          description: 'Test order'
        }
      ]
    };

    const response = await fetch(PAYPAL_BASE_URL + '/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken
      },
      body: JSON.stringify(testOrderData)
    });

    if (response.ok) {
      const data = await response.json() as { id: string };
      console.log('PayPal test order created successfully:', data.id);
      return true;
    } else {
      const errorData = await response.json() as any;
      console.error('PayPal test order failed:', errorData);
      return false;
    }
  } catch (error) {
    console.error('PayPal connection test failed:', error);
    return false;
  }
}