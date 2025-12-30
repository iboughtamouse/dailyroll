// Personal Stats API Endpoint
// Returns user's personal stats for !stats command

import { Redis } from '@upstash/redis';
import { getUserStats, getLeaderboardRanks, formatStatsResponse } from '../lib/stats.js';
import { validateAndGetContext } from '../lib/fossabot.js';

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
    
    const context = validation.data;
    
    // Channel gating
    const channelName = context.channel?.display_name?.toUpperCase();
    const expectedChannel = process.env.STREAMER_NAME?.toUpperCase();
    
    if (channelName !== expectedChannel) {
      console.log(`❌ Channel mismatch: ${channelName} !== ${expectedChannel}`);
      res.status(403).send('This command is not available in this channel');
      return;
    }
    
    // Extract user info
    const username = context.message?.user?.display_name || context.message?.user?.login || 'Unknown';
    const userId = context.message?.user?.provider_id;
    
    if (!userId) {
      res.status(400).send('Could not identify user');
      return;
    }
    
    console.log('=== STATS REQUEST ===');
    console.log('User:', username);
    console.log('User ID:', userId);
    
    // Initialize Redis client
    const redis = Redis.fromEnv();
    
    // Get user stats
    const stats = await getUserStats(redis, userId);
    
    if (!stats || stats.totalRolls === 0) {
      console.log('❌ No stats found for user');
      const response = `${username}: No rolls yet! Type !roll to get started.`;
      console.log('📤 RESPONSE:', response);
      res.status(200).send(response);
      return;
    }
    
    // Get leaderboard ranks
    const ranks = await getLeaderboardRanks(redis, userId);
    
    console.log('✅ Stats found:', {
      totalRolls: stats.totalRolls,
      currentIQ: stats.currentIQ,
      highestIQ: stats.highestIQ,
      ranks
    });
    
    // Format and return response
    const response = formatStatsResponse(username, stats, ranks);
    
    console.log('📤 RESPONSE:', response);
    console.log('📤 RESPONSE LENGTH:', response.length);
    
    // Safety check for character limit
    if (response.length > 450) {
      console.warn('⚠️ Response exceeds safe length:', response.length);
    }
    
    res.status(200).send(response);
    
  } catch (error) {
    console.error('❌ Error in stats endpoint:', error);
    res.status(500).send('Error retrieving stats');
  }
}
