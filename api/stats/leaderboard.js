// Leaderboard API Endpoint
// Returns top 5 performers for !t500, !top500, !leaderboard commands
// Randomly rotates between IQ, height, and rolls leaderboards

import { Redis } from '@upstash/redis';
import { getTopN, formatLeaderboardResponse } from '../lib/stats.js';
import { validateAndGetContext } from '../lib/fossabot.js';

/**
 * Randomly select a leaderboard type
 */
function selectRandomLeaderboard() {
  const types = ['iq', 'height'];
  return types[Math.floor(Math.random() * types.length)];
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
    
    console.log('=== LEADERBOARD REQUEST ===');
    console.log('Channel:', channelName);
    
    // Get channel provider ID
    const channelProviderId = context.channel?.provider_id;
    if (!channelProviderId) {
      res.status(400).send('Could not identify channel');
      return;
    }
    
    // Initialize Redis client
    const redis = Redis.fromEnv();
    
    // Get stream key
    const { getStreamKey } = await import('../lib/stats.js');
    const streamKey = await getStreamKey(redis, channelProviderId);
    
    // Check query param or randomly select
    const requestedType = req.query.type;
    const validTypes = ['iq', 'height'];
    const type = (requestedType && validTypes.includes(requestedType)) 
      ? requestedType 
      : selectRandomLeaderboard();
    
    const leaderboardKey = `dailyroll:leaderboard:${streamKey}:${type}`;
    
    console.log('📊 Selected leaderboard:', type);
    console.log('📊 Stream key:', streamKey);
    console.log('📊 Using key:', leaderboardKey);
    
    // Get top 5
    const entries = await getTopN(redis, leaderboardKey, 5, true);
    
    console.log('📊 getTopN returned:', entries);
    
    console.log(`✅ Retrieved ${entries.length} entries`);
    
    // Format and return response
    const response = formatLeaderboardResponse(type, entries);
    
    console.log('📤 RESPONSE:', response);
    console.log('📤 RESPONSE LENGTH:', response.length);
    
    // Safety check for character limit
    if (response.length > 450) {
      console.warn('⚠️ Response exceeds safe length:', response.length);
    }
    
    res.status(200).send(response);
    
  } catch (error) {
    console.error('❌ Error in leaderboard endpoint:', error);
    res.status(500).send('Error retrieving leaderboard');
  }
}
