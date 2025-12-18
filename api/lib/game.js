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
 * Get extreme value reactions for special rolls
 */
function getExtremeReaction(iq, height) {
  const reactions = [];
  
  // Parse height to inches for comparison
  const [feet, inches] = height.split("'").map(s => parseInt(s.replace('"', '')));
  const totalInches = (feet * 12) + inches;
  
  // IQ reactions
  if (iq >= 190) reactions.push('GIGABRAIN 🧠');
  else if (iq < 50) reactions.push('pure chaos energy 🐹');
  
  // Height reactions
  if (totalInches >= 108) reactions.push('ABSOLUTE UNIT 🏔️');  // 9'+
  else if (totalInches < 24) reactions.push('smol bean 🐁');  // <2'
  
  return reactions.length > 0 ? ' ' + reactions.join(' ') : '';
}

/**
 * Format the daily roll response with tier-specific flavor text
 */
export function formatRollResponse(username, iq, height, heroData, isPersonalBest = false) {
  const { hero, tier, tierName} = heroData;
  const extreme = getExtremeReaction(iq, height);
  
  // Fortune-style templates (like sr2)
  const fortuneTemplates = [
    `🎲 ${username} rolled ${iq} IQ, ${height} - {flavor}. Play ${hero}.`,
    `✨ The dice speak: ${username} got ${iq} IQ and ${height}. {flavor}. ${hero} awaits.`,
    `🌟 ${username}: ${iq} IQ, ${height} tall - {flavor}. Time for ${hero}.`,
    `🎴 Destiny reveals: ${iq} IQ, ${height} for ${username}. {flavor}. Play ${hero}.`,
    `⭐ ${username} manifested ${iq} IQ and ${height} - {flavor}. ${hero} it is.`,
    `🔮 The universe whispers: ${username} rolled ${iq} IQ, ${height}. {flavor}. ${hero} ready.`,
    `💫 ${username}: IQ ${iq}, Height ${height} - {flavor}. ${hero} calls to you.`,
    `🎯 RNG gods decree: ${username} gets ${iq} IQ and ${height}. {flavor}. Play ${hero}.`
  ];
  
  // Tier-specific flavor text
  const flavorByTier = {
    1: [  // Hamster tier
      'literal hamster brain',
      'pure instinct mode',
      'reject humanity',
      hero === "Torbjörn" ? "you ARE the turret" : "basically a pet",
      'all vibes no thoughts',
      'consciousness optional'
    ],
    2: [  // Unga tier
      'unga bunga energy',
      'big weapon, simple plan',
      'you see enemy, you hit enemy',
      'thinks with their fists',
      'pure aggression',
      'monkey brain activated'
    ],
    3: [  // Normal tier
      'perfectly average',
      "you're fine",
      'functioning human energy',
      'unremarkable but reliable',
      'nothing special',
      'mediocrity achieved'
    ],
    4: [  // Bigbrain tier
      'actually has a plan',
      "you've got a brain, use it",
      'high skill expression',
      'thinks before shooting',
      'galaxy brain time',
      'tactical genius incoming'
    ],
    5: [  // Overqualified tier
      'overqualified for this lobby',
      'wasting your talent here',
      'too good for this',
      'absolute legend energy',
      'devilish beast mode',
      'smurf energy'
    ]
  };
  
  // Pick random template and flavor
  const template = fortuneTemplates[Math.floor(Math.random() * fortuneTemplates.length)];
  const flavors = flavorByTier[tier];
  const flavor = flavors[Math.floor(Math.random() * flavors.length)];
  
  let response = template.replace('{flavor}', flavor);
  
  // Add Reinhardt special (the CHUNGUS)
  if (hero === "Reinhardt" && tier === 2) {
    response += " HONOR!! JUSTICE!! CHUNGUS FUCKING CHUNGUS!";
  }
  
  // Add extreme reactions
  response += extreme;
  
  // Add personal best celebration
  if (isPersonalBest) {
    response += ' 🎉 New personal best!';
  }
  
  return response;
}
