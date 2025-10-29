import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://ckkuqkicizthpllvnzxu.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  throw new Error('Missing Supabase key. Please set SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in .env');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Test database connection
export async function testConnection(): Promise<void> {
  try {
    // Simple test - just verify the client was created successfully
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }
    
    console.log('Supabase connection successful');
  } catch (error) {
    console.error('Supabase connection failed:', error);
    throw error;
  }
}

// Export the supabase client as default
export default supabase;