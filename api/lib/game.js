// Game logic for Daily Roll
// Contains hero roster, generators, formatters, and insults

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load hero roster from JSON
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const heroData = JSON.parse(readFileSync(join(__dirname, '../data/heroes.json'), 'utf-8'));

// Validate JSON structure on load
if (!Array.isArray(heroData?.tiers)) {
  throw new Error('heroes.json is malformed: missing or invalid tiers array');
}

const requiredTiers = ['hamster', 'unga', 'normal', 'bigbrain', 'overqualified'];
for (const tierName of requiredTiers) {
  const tier = heroData.tiers.find(t => t?.name === tierName);
  if (!tier) {
    throw new Error(`heroes.json is malformed: missing tier "${tierName}"`);
  }
  if (!Array.isArray(tier.heroes) || tier.heroes.length === 0) {
    throw new Error(`heroes.json is malformed: tier "${tierName}" has no heroes`);
  }
}

// Extract tier arrays from JSON for backwards compatibility
const TIER_HAMSTER = heroData.tiers.find(t => t.name === 'hamster').heroes;
const TIER_UNGA = heroData.tiers.find(t => t.name === 'unga').heroes;
const TIER_NORMAL = heroData.tiers.find(t => t.name === 'normal').heroes;
const TIER_BIGBRAIN = heroData.tiers.find(t => t.name === 'bigbrain').heroes;
const TIER_OVERQUALIFIED = heroData.tiers.find(t => t.name === 'overqualified').heroes;

// Insults for users who try to roll too early
export const INSULTS = [
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

/**
 * Generate random IQ between 0-200
 */
export function generateIQ() {
  return Math.floor(Math.random() * 201);
}

/**
 * Generate random height in feet'inches format (0-9 feet, 0-11 inches)
 */
export function generateHeight() {
  const feet = Math.floor(Math.random() * 10);
  const inches = Math.floor(Math.random() * 12);
  return `${feet}'${inches}"`;
}

/**
 * Calculate tier based on IQ and height
 * Returns tier number (1-5) and the hero pool for that tier
 */
function calculateTier(iq, heightString) {
  // Convert height string (e.g., "6'3"") to total inches
  const [feet, inches] = heightString.replace('"', '').split("'").map(Number);
  const totalInches = feet * 12 + inches;
  
  // Calculate combined score (0-1 range)
  // IQ: 0-200, Height: 0-119 inches (9'11")
  const iqScore = iq / 200;
  const heightScore = totalInches / 119;
  const combinedScore = (iqScore + heightScore) / 2;
  
  // Determine tier based on percentile
  if (combinedScore < 0.15) {
    return { tier: 1, pool: TIER_HAMSTER, name: "hamster" };
  } else if (combinedScore < 0.35) {
    return { tier: 2, pool: TIER_UNGA, name: "unga" };
  } else if (combinedScore < 0.65) {
    return { tier: 3, pool: TIER_NORMAL, name: "normal" };
  } else if (combinedScore < 0.85) {
    return { tier: 4, pool: TIER_BIGBRAIN, name: "bigbrain" };
  } else {
    return { tier: 5, pool: TIER_OVERQUALIFIED, name: "overqualified" };
  }
}

/**
 * Pick random hero from the appropriate tier
 */
export function generateHero(iq, height) {
  const tierInfo = calculateTier(iq, height);
  return {
    hero: tierInfo.pool[Math.floor(Math.random() * tierInfo.pool.length)],
    tier: tierInfo.tier,
    tierName: tierInfo.name
  };
}

/**
 * Pick random insult
 */
export function getRandomInsult() {
  return INSULTS[Math.floor(Math.random() * INSULTS.length)];
}

/**
 * Format the daily roll response with tier-specific flavor text
 */
export function formatRollResponse(username, iq, height, heroData) {
  const { hero, tier, tierName } = heroData;
  
  // Tier 1: "Literally a pet" 
  const hamsterFormats = [
    `${username} rolled ${iq} IQ and ${height} height - literal hamster brain. Play ${hero}.`,
    `${username}: ${iq} IQ, ${height} tall. You are ${hero === "Torbjörn" ? "the turret" : "basically a pet"}. Play ${hero}.`,
    `IQ ${iq}, Height ${height} - ${username} operates on pure instinct. ${hero} it is.`,
    `${username} got ${iq} IQ and ${height}. Reject humanity, return to ${hero}.`
  ];
  
  // Tier 2: "Unga bunga"
  const ungaFormats = [
    `${username} rolled ${iq} IQ, ${height} - unga bunga energy. Play ${hero}.`,
    `${iq} IQ and ${height} for ${username}. Big weapon, simple plan. ${hero} awaits.`,
    `${username}: ${iq} IQ, ${height} tall - you see enemy, you hit enemy. Play ${hero}.`,
    `IQ ${iq}, Height ${height} - ${username} thinks with their fists. Time for ${hero}.`
  ].map((response) => response + (hero === "Reinhardt" ? " HONOR!! JUSTICE!! CHUNGUS FUCKING CHUNGUS!" : ""));
  
  // Tier 3: "Functioning human"
  const normalFormats = [
    `${username} rolled ${iq} IQ and ${height} - you're fine. Play ${hero}.`,
    `${username}: IQ ${iq}, ${height} tall. Perfectly average. ${hero} suits you.`,
    `${iq} IQ, ${height} for ${username} - congrats on being unremarkable. Play ${hero}.`,
    `${username} got ${iq} IQ and ${height}. Nothing special, play ${hero}.`
  ];
  
  // Tier 4: "Big brain"
  const bigbrainFormats = [
    `${username} rolled ${iq} IQ, ${height} - actually has a plan. Play ${hero}.`,
    `IQ ${iq} and ${height} for ${username}. High skill expression time: ${hero}.`,
    `${username}: ${iq} IQ, ${height} tall - you've got a brain, use it. Play ${hero}.`,
    `${iq} IQ, ${height} - ${username} thinks before shooting. ${hero} ready.`
  ];
  
  // Tier 5: "Overqualified"
  const overqualifiedFormats = [
    `${username} rolled ${iq} IQ and ${height} - overqualified. Play ${hero} and carry these idiots.`,
    `IQ ${iq}, Height ${height} - ${username} is wasting their time here. Play ${hero}.`,
    `${username}: ${iq} IQ, ${height} tall. Why are you even here? Play ${hero}.`,
    `${iq} IQ, ${height} for ${username} - too good for this. Like ${hero}. You devilish beast. You sly motherfucker.`
  ];
  
  const formatsByTier = {
    1: hamsterFormats,
    2: ungaFormats,
    3: normalFormats,
    4: bigbrainFormats,
    5: overqualifiedFormats
  };
  
  const formats = formatsByTier[tier];
  return formats[Math.floor(Math.random() * formats.length)];
}
