// Daily Roll API for Fossabot (Redis Version)
// Returns random IQ, height, and hero with per-stream cooldown (when live) or 24-hour cooldown (when offline)

import { Redis } from '@upstash/redis';
import { getStreamStartTime } from './lib/twitch.js';
import { 
  generateIQ, 
  generateHeight, 
  generateHero, 
  getRandomInsult, 
  formatRollResponse 
} from './lib/game.js';

// Redis expiration for user data
const REDIS_EXPIRATION = 48 * 60 * 60; // 48 hours in seconds

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
  
  // Get twitch channel name
  const isAugust = req.headers['x-fossabot-channeldisplayname'] === "AUGUST"
  
  if (!token) {
    res.status(400).send('Missing Fossabot token');
    return;
  }

  if (!isAugust) res.status(400).send('Get out of my fucking API you shitter')
  
  // Validate request and get context
  const validation = await validateAndGetContext(token);
  
  if (!validation.valid) {
    res.status(400).send(validation.error);
    return;
  }
  
  const context = validation.data;
  
  // Extract user info
  const username = context.message?.user?.display_name || context.message?.user?.login || 'Unknown';
  const userId = context.message?.user?.provider_id;
  const channelProviderId = context.channel?.provider_id;
  const isLive = context.channel?.is_live || false;
  
  if (!userId) {
    res.status(400).send('Could not identify user');
    return;
  }
  
  if (!channelProviderId) {
    res.status(400).send('Could not identify channel');
    return;
  }
  
  // Initialize Redis client
  const redis = Redis.fromEnv();
  
  // Get actual stream start time from Twitch API if live
  let streamStartTime = null;
  if (isLive) {
    try {
      const startedAt = await getStreamStartTime(redis, channelProviderId);
      if (startedAt) {
        streamStartTime = new Date(startedAt).getTime();
      }
    } catch (error) {
      console.error('Error fetching stream start time:', error);
      // Continue without stream start time - will fall back to 24-hour cooldown
    }
  }
  
  // Check if user has rolled before
  const now = Date.now();
  const userRollKey = `dailyroll:${userId}`;
  const userData = await redis.get(userRollKey);
  
  // Log current state for monitoring
  console.log('=== DAILYROLL REQUEST ===');
  console.log('User:', username);
  console.log('Current time:', new Date(now).toISOString());
  console.log('Is live:', isLive);
  console.log('Stream start time:', streamStartTime ? new Date(streamStartTime).toISOString() : 'N/A');
  
  if (streamStartTime) {
    const minutesSinceStreamStart = Math.round((now - streamStartTime) / 1000 / 60);
    console.log('Minutes since stream start:', minutesSinceStreamStart);
  }
  
  if (userData && userData.lastRoll) {
    console.log('Last roll:', new Date(userData.lastRoll).toISOString());
    const minutesSinceLastRoll = Math.round((now - userData.lastRoll) / 1000 / 60);
    console.log('Minutes since last roll:', minutesSinceLastRoll);
    console.log('Current spam count:', userData.spamCount || 0);
  } else {
    console.log('No previous roll data');
  }
  
  // Determine if user is in cooldown
  let inCooldown = false;
  let cooldownReason = '';
  
  if (userData && userData.lastRoll) {
    if (isLive && streamStartTime) {
      // LIVE: Check if they rolled during current stream
      inCooldown = userData.lastRoll > streamStartTime;
      cooldownReason = inCooldown 
        ? `Rolled during current stream (${new Date(userData.lastRoll).toISOString()} > ${new Date(streamStartTime).toISOString()})`
        : `Last roll was before this stream started`;
    } else {
      // OFFLINE or couldn't get stream start time: Use 24-hour cooldown
      const OFFLINE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
      const timeSinceLastRoll = now - userData.lastRoll;
      inCooldown = timeSinceLastRoll < OFFLINE_COOLDOWN_MS;
      cooldownReason = inCooldown
        ? `Within 24-hour offline cooldown (${Math.round(timeSinceLastRoll / 1000 / 60)} minutes ago)`
        : `24-hour cooldown expired`;
    }
  }
  
  console.log('In cooldown:', inCooldown);
  console.log('Reason:', cooldownReason);
  console.log('========================');
  
  if (inCooldown) {
    // User is in cooldown - send insult
    console.log('❌ Cooldown active - sending insult');
    const insult = getRandomInsult();
    console.log('📤 RESPONSE (INSULT):', JSON.stringify(insult));
    console.log('📤 RESPONSE LENGTH:', insult.length);
    res.status(200).send(insult);
    return;
  }
  
  // Generate new roll
  const iq = generateIQ();
  const height = generateHeight();
  const heroData = generateHero(iq, height);
  
  console.log('✅ Successful roll - generating new stats');
  console.log(`Generated: IQ ${iq}, Height ${height}, Hero ${heroData.hero} (Tier ${heroData.tier})`);
  
  // Store timestamp and reset spam count with 48-hour expiration
  await redis.set(userRollKey, {
    lastRoll: now,
    spamCount: 0
  }, {
    ex: REDIS_EXPIRATION
  });
  
  // Format and return response
  const response = formatRollResponse(username, iq, height, heroData);
  console.log('📤 RESPONSE (SUCCESS):', JSON.stringify(response));
  console.log('📤 RESPONSE LENGTH:', response.length);
  res.status(200).send(response);
}
