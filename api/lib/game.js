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
  "imagine being this desperate for RNG",
  "the audacity",
  "no. just no.",
  "bro really thought 💀",
  "not you trying to cheat the system",
  "the greed is astronomical",
  "erm what the sigma? (you can't roll twice)",
  "chat is this real? 🤨📸",
  "least greedy twitch chatter",
  "my brother in christ it hasn't been 24 hours",
  "you're done, you're done 🫵",
  "reported to the cyber police",
  "you're one roll short of a timeout",
  "the CHUNGUS would be disappointed",
  "even the hamsters know better than this",
  "the bot is judging you so hard right now",
  "60 second vacation incoming if you try again",
  "asking for a second roll is crazy work",
  "you must be new here (you're not)",
  "y'no what. i dont like you. yeah. ive decided i dont like you."
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
export function formatRollResponse(username, iq, height, heroData, isPersonalBest = false) {
  const { hero, tier, tierName} = heroData;
  
  // Fortune-style templates (like sr2)
  const fortuneTemplates = [
    `🎲 ${username} rolled ${iq} IQ, ${height} - {flavor}. Play ${hero}.`,
    `✨ The cosmic dice declare: ${username} gets ${iq} IQ and ${height}. {flavor}. ${hero} awaits.`,
    `🌟 ${username}: ${iq} IQ, ${height} tall - {flavor}. Your destiny calls with ${hero}.`,
    `🎴 The ancient scrolls reveal: ${username} manifests ${iq} IQ, ${height}. {flavor}. Play ${hero}.`,
    `⭐ ${username} has been blessed with ${iq} IQ and ${height} - {flavor}. ${hero} is your calling.`,
    `🔮 The mystical orbs show: ${username} rolled ${iq} IQ, ${height}. {flavor}. ${hero} beckons.`,
    `💫 ${username}: IQ ${iq}, Height ${height} - {flavor}. The stars align for ${hero}.`,
    `🎯 Fate's algorithm computes: ${username} receives ${iq} IQ and ${height}. {flavor}. Play ${hero}.`,
    `🎪 ${username} steps into the spotlight: ${iq} IQ, ${height}. {flavor}. ${hero} is your role.`,
    `🎭 The drama unfolds: ${username} with ${iq} IQ and ${height}. {flavor}. Starring as ${hero}.`,
    `🎨 ${username}'s masterpiece: ${iq} IQ, ${height} tall - {flavor}. Signed by ${hero}.`,
    `🎪 The carnival of chance: ${username} wins ${iq} IQ and ${height}. {flavor}. Prize: ${hero}.`
  ];
  
  // Tier-specific flavor text
  const flavorByTier = {
    1: [  // Hamster tier
      'running on pure instinct and questionable decisions',
      'the hamster wheel of destiny keeps spinning',
      'consciousness is overrated anyway',
      hero === "Torbjörn" ? "you ARE the turret, and that's beautiful" : "basically a very confused squirrel",
      'vibes over validation',
      'the universe said "surprise me" and got exactly that',
      'plot armor made of cardboard',
      'strategically chaotic'
    ],
    2: [  // Unga tier
      'peak caveman gaming energy',
      'the bigger the hammer, the better the plan',
      'diplomacy? never heard of her',
      'thinks with fists, acts with fury',
      'the art of the aggressive nap',
      'monkey see, monkey smash',
      'honor, justice, and questionable tactics',
      'the CHUNGUS approach to problem-solving'
    ],
    3: [  // Normal tier
      'perfectly adequate, suspiciously so',
      'the sweet spot of mediocrity',
      'functioning at acceptable levels',
      'neither hero nor zero',
      'the reliable middle child of gaming',
      'competent but not concerning anyone',
      'balanced like a diet that actually works',
      'the Goldilocks zone of talent'
    ],
    4: [  // Bigbrain tier
      'actually read the hero descriptions',
      'tactical genius with a side of overthinking',
      'the calculator in a world of rock-paper-scissors',
      'strategy so deep it needs a lifeguard',
      'thinks in three dimensions, plays in two',
      'the chess master in checkers clothing',
      'galaxy brain activated, local brain confused',
      'the overachiever of the lobby'
    ],
    5: [  // Overqualified tier
      'wasting potential like it\'s going out of style',
      'too skilled for this nonsense',
      'the pro in a noob lobby',
      'talent level: intimidating',
      'could carry the team with one hand tied',
      'the legend everyone whispers about',
      'smurf energy with extra smug',
      'absolute unit of competence'
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
  
  // Add personal best celebration
  if (isPersonalBest) {
    response += ' 🎉 New personal best!';
  }
  
  return response;
}
