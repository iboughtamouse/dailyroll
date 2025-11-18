// Game logic for Daily Roll
// Contains hero roster, generators, formatters, and insults

// Overwatch 2 hero roster (as of Season 19)
export const HEROES = [
  "Ana", "Ashe", "Baptiste", "Bastion", "Brigitte", "Cassidy", "D.Va", 
  "Doomfist", "Echo", "Genji", "Hanzo", "Hazard", "Illari", "Junker Queen",
  "Junkrat", "Juno", "Kiriko", "Lifeweaver", "Lúcio", "Mauga", "Mei",
  "Mercy", "Moira", "Orisa", "Pharah", "Ramattra", "Reaper", "Reinhardt",
  "Roadhog", "Sigma", "Sojourn", "Soldier: 76", "Sombra", "Symmetra",
  "Torbjörn", "Tracer", "Venture", "Widowmaker", "Winston", "Wrecking Ball",
  "Zarya", "Zenyatta"
];

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
 * Pick random hero from roster
 */
export function generateHero() {
  return HEROES[Math.floor(Math.random() * HEROES.length)];
}

/**
 * Pick random insult
 */
export function getRandomInsult() {
  return INSULTS[Math.floor(Math.random() * INSULTS.length)];
}

/**
 * Format the daily roll response with fun styling
 */
export function formatRollResponse(username, iq, height, hero) {
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
