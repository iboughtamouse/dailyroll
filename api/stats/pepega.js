// Pepega Leaderboard API Endpoint
// Returns bottom 5 performers for !b500, !bottom500, !pepega commands

import { Redis } from '@upstash/redis';
import { getTopN, formatPepegaResponse } from '../lib/stats.js';

/**
 * Validate the Fossabot request and get context
 */
async function validateAndGetContext(token) {
  const response = await fetch(`https://api.fossabot.com/v2/customapi/context/${token}`);
  
  if (!response.ok) {
    return { valid: false, error: 'Invalid or expired token' };
  }
  
  const data = await response.json();
  return { valid: true, data };
}

/**
 * Main handler
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Get the Fossabot token from headers
  const token = req.headers['x-fossabot-customapitoken'];
  
  if (!token) {
    res.status(400).send('Missing Fossabot token');
    return;
  }
  
  try {
    // Validate request and get context
    const validation = await validateAndGetContext(token);
    
    if (!validation.valid) {
      res.status(400).send(validation.error);
      return;
    }
    
    // Channel gating
    const context = validation.data;
    const channelName = context.channel?.display_name?.toUpperCase();
    const expectedChannel = process.env.STREAMER_NAME?.toUpperCase();
    
    if (channelName !== expectedChannel) {
      console.log(`❌ Channel mismatch: ${channelName} !== ${expectedChannel}`);
      res.status(403).send('This command is not available in this channel');
      return;
    }
    
    console.log('=== PEPEGA REQUEST ===');
    console.log('Channel:', channelName);
    
    // Initialize Redis client
    const redis = Redis.fromEnv();
    
    console.log('📊 Fetching bottom 5 pepega scores...');
    
    // Get bottom 5 (lowest pepega scores)
    const entries = await getTopN(redis, 'dailyroll:leaderboard:pepega', 5, false);
    
    console.log('📊 getTopN returned:', entries);
    
    console.log(`✅ Retrieved ${entries.length} pepega entries`);
    
    // Format and return response
    const response = formatPepegaResponse(entries);
    
    console.log('📤 RESPONSE:', response);
    console.log('📤 RESPONSE LENGTH:', response.length);
    
    // Safety check for character limit
    if (response.length > 450) {
      console.warn('⚠️ Response exceeds safe length:', response.length);
    }
    
    res.status(200).send(response);
    
  } catch (error) {
    console.error('❌ Error in pepega endpoint:', error);
    res.status(500).send('Error retrieving pepega leaderboard');
  }
}
