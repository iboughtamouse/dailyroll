// Daily Roll API for Fossabot (Redis Version)
// Returns random IQ, height, and hero with 14-hour cooldown per user

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

// Cooldown duration: 14 hours in milliseconds
const COOLDOWN_MS = 14 * 60 * 60 * 1000;

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
  
  if (!userId) {
    res.status(400).send('Could not identify user');
    return;
  }
  
  // Initialize Redis client
  const redis = Redis.fromEnv();
  
  // Check if user has rolled before
  const now = Date.now();
  const userRollKey = `dailyroll:${userId}`;
  const spamKey = `dailyroll:spam:${userId}`;
  const userRoll = await redis.get(userRollKey);
  
  if (userRoll) {
    const timeSinceLastRoll = now - userRoll.lastRoll;
    
    // If within cooldown period, track spam and send insult
    if (timeSinceLastRoll < COOLDOWN_MS) {
      // Get current spam count
      const spamCount = await redis.get(spamKey) || 0;
      const newSpamCount = parseInt(spamCount) + 1;
      
      // Update spam count with 15-hour expiration
      await redis.set(spamKey, newSpamCount, {
        ex: Math.ceil((COOLDOWN_MS + 3600000) / 1000)
      });
      
      // If they've tried 2+ times, timeout for 60 seconds
      if (newSpamCount >= 2) {
        const insult = getRandomInsult();
        res.status(200).send(`/timeout ${username} 60s ${insult}`);
        return;
      }
      
      // Otherwise just send regular insult
      const insult = getRandomInsult();
      res.status(200).send(insult);
      return;
    }
  }
  
  // Generate new roll
  const iq = generateIQ();
  const height = generateHeight();
  const hero = generateHero();
  
  // Store in Redis with 15-hour expiration (slightly longer than cooldown for safety)
  await redis.set(userRollKey, {
    lastRoll: now,
    iq,
    height,
    hero
  }, {
    ex: Math.ceil((COOLDOWN_MS + 3600000) / 1000) // 14 hours + 1 hour buffer
  });
  
  // Clear spam counter on successful roll
  await redis.del(spamKey);
  
  // Format and return response
  const response = formatRollResponse(username, iq, height, hero);
  res.status(200).send(response);
}
