// Daily Roll API for Fossabot (Redis Version)
// Returns random IQ, height, and hero with per-stream cooldown (when live) or 24-hour cooldown (when offline)

import { Redis } from '@upstash/redis';

// Overwatch 2 hero roster (as of Season 19)
const HEROES = [
  "Ana", "Ashe", "Baptiste", "Bastion", "Brigitte", "Cassidy", "D.Va", 
  "Doomfist", "Echo", "Genji", "Hanzo", "Hazard", "Illari", "Junker Queen",
  "Junkrat", "Juno", "Kiriko", "Lifeweaver", "Lúcio", "Mauga", "Mei",
  "Mercy", "Moira", "Orisa", "Pharah", "Ramattra", "Reaper", "Reinhardt",
  "Roadhog", "Sigma", "Sojourn", "Soldier: 76", "Sombra", "Symmetra",
  "Torbjörn", "Tracer", "Venture", "Widowmaker", "Winston", "Wrecking Ball",
  "Zarya", "Zenyatta"
];

// Insults for users who try to roll too early
const INSULTS = [
  "nice double roll JACKASS",
  "bro thinks they can roll twice lmao",
  "greedy much? come back later",
  "did you think I wouldn't notice? 🤨",
  "one roll per day, genius",
  "patience is a virtue you clearly lack",
  "imagine being this desperate for RNG",
  "the audacity",
  "no. just no.",
  "someone didn't read the rules smh",
  "bro really thought 💀",
  "not you trying to cheat the system",
  "the greed is astronomical",
  "erm what the sigma? (you can't roll twice)",
  "chat is this real? 🤨📸",
  "least greedy twitch chatter",
  "my brother in christ it hasn't been 14 hours",
  "you're done, you're done 🫵",
  "reported to the cyber police"
];

// Cooldown duration: 14 hours in milliseconds (legacy, kept for expiration buffer)
const COOLDOWN_MS = 14 * 60 * 60 * 1000;
const REDIS_EXPIRATION = 48 * 60 * 60; // 48 hours in seconds

/**
 * Generate random IQ between 0-200
 */
function generateIQ() {
  return Math.floor(Math.random() * 201);
}

/**
 * Generate random height in feet'inches format (0-9 feet, 0-11 inches)
 */
function generateHeight() {
  const feet = Math.floor(Math.random() * 10);
  const inches = Math.floor(Math.random() * 12);
  return `${feet}'${inches}"`;
}

/**
 * Pick random hero from roster
 */
function generateHero() {
  return HEROES[Math.floor(Math.random() * HEROES.length)];
}

/**
 * Pick random insult
 */
function getRandomInsult() {
  return INSULTS[Math.floor(Math.random() * INSULTS.length)];
}

/**
 * Format the daily roll response with fun styling
 */
function formatRollResponse(username, iq, height, hero) {
  // Multiple response format variations for variety
  const formats = [
    `${username}'s Daily Roll: IQ ${iq} | Height ${height} | Hero: ${hero}`,
    `🎲 ${username} rolled: ${iq} IQ, ${height} tall, destined for ${hero}`,
    `Daily Stats for ${username}: IQ ${iq} • ${height} • Should play ${hero}`,
    `${username}: IQ=${iq} | Height=${height} | Today's hero: ${hero}`,
    `[${username}] IQ: ${iq} | ${height} | Hero Roll: ${hero} 🎯`
  ];
  
  return formats[Math.floor(Math.random() * formats.length)];
}

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
  const isLive = context.channel?.is_live || false;
  const streamTimestamp = context.channel?.stream_timestamp;
  
  if (!userId) {
    res.status(400).send('Could not identify user');
    return;
  }
  
  // Initialize Redis client
  const redis = Redis.fromEnv();
  
  // Check if user has rolled before
  const now = Date.now();
  const userRollKey = `dailyroll:${userId}`;
  const userData = await redis.get(userRollKey);
  
  // Log current state for monitoring
  console.log('=== DAILYROLL REQUEST ===');
  console.log('User:', username);
  console.log('Current time:', new Date(now).toISOString());
  console.log('Is live:', isLive);
  console.log('Stream timestamp:', streamTimestamp);
  
  if (streamTimestamp) {
    const streamStartTime = new Date(streamTimestamp).getTime();
    const minutesSinceStreamStart = Math.round((now - streamStartTime) / 1000 / 60);
    console.log('Minutes since stream_timestamp:', minutesSinceStreamStart);
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
    if (isLive && streamTimestamp) {
      // LIVE: Check if they rolled during current stream
      const streamStartTime = new Date(streamTimestamp).getTime();
      inCooldown = userData.lastRoll > streamStartTime;
      cooldownReason = inCooldown 
        ? `Rolled during current stream (${new Date(userData.lastRoll).toISOString()} > ${streamTimestamp})`
        : `Last roll was before this stream started`;
    } else {
      // OFFLINE: Use 24-hour cooldown
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
    // User is in cooldown - track spam
    const spamCount = (userData.spamCount || 0) + 1;
    
    console.log('❌ Cooldown active - spam count:', spamCount);
    
    // Update user data with incremented spam count
    await redis.set(userRollKey, {
      lastRoll: userData.lastRoll,  // Keep existing timestamp
      spamCount: spamCount
    }, {
      ex: REDIS_EXPIRATION
    });
    
    // If they've tried 2+ times, timeout for 60 seconds
    if (spamCount >= 2) {
      console.log('⏱️ Timeout triggered (spam count >= 2)');
      const insult = getRandomInsult();
      res.status(200).send(`/timeout ${username} 60s ${insult}`);
      return;
    }
    
    // Otherwise just send regular insult
    console.log('💬 Sending insult (spam count < 2)');
    const insult = getRandomInsult();
    res.status(200).send(insult);
    return;
  }
  
  // Generate new roll
  const iq = generateIQ();
  const height = generateHeight();
  const hero = generateHero();
  
  console.log('✅ Successful roll - generating new stats');
  
  // Store timestamp and reset spam count with 48-hour expiration
  await redis.set(userRollKey, {
    lastRoll: now,
    spamCount: 0
  }, {
    ex: REDIS_EXPIRATION
  });
  
  // Format and return response
  const response = formatRollResponse(username, iq, height, hero);
  res.status(200).send(response);
}
