// Stats management utilities for Daily Roll
// Handles user stats tracking and leaderboard updates

import { getStreamStartTime } from './twitch.js';

/**
 * Get stream-specific key for leaderboards
 * Uses stream start time as unique identifier (like sr2)
 * @param {Redis} redis - Redis client
 * @param {string} providerId - Twitch user ID of streamer
 * @returns {string} Stream key like "stream_2025-12-18T12:34:56Z" or "offline_2025-12-18"
 */
export async function getStreamKey(redis, providerId) {
  try {
    const startTime = await getStreamStartTime(redis, providerId);
    if (startTime) {
      // Use ISO timestamp as key (e.g., "2025-12-18T12:34:56Z")
      return `stream_${startTime}`;
    }
  } catch (error) {
    console.error('Error getting stream start time:', error);
  }
  
  // Fallback to date-based key when offline or error
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `offline_${today}`;
}

/**
 * Convert height string (e.g., "6'3"") to total inches
 */
export function heightToInches(heightString) {
  const [feet, inches] = heightString.replace('"', '').split("'").map(Number);
  return feet * 12 + inches;
}

/**
 * Calculate pepega score from user stats
 * Lower score = more pepega (worse luck)
 * Formula: 40% IQ, 30% height, 30% non-hamster tier rate
 */
export function calculatePepegaScore(stats) {
  const avgIQ = stats.totalRolls > 0 ? stats.sumIQ / stats.totalRolls : 0;
  const avgHeightInches = stats.totalRolls > 0 ? stats.sumHeightInches / stats.totalRolls : 0;
  
  // Non-hamster rate (tiers 2-5)
  const nonHamsterCount = (stats.tier2Count || 0) + (stats.tier3Count || 0) + 
                          (stats.tier4Count || 0) + (stats.tier5Count || 0);
  const nonHamsterRate = stats.totalRolls > 0 ? nonHamsterCount / stats.totalRolls : 0;
  
  // Weighted score (0-1 range)
  const iqComponent = (avgIQ / 200) * 0.4;
  const heightComponent = (avgHeightInches / 119) * 0.3;
  const tierComponent = nonHamsterRate * 0.3;
  
  return iqComponent + heightComponent + tierComponent;
}

/**
 * Update user stats after a roll
 * @param {Redis} redis - Upstash Redis client
 * @param {string} userId - User's provider ID
 * @param {string} username - User's display name
 * @param {string} providerId - Streamer's provider ID for stream key
 * @param {Object} rollData - { iq, height, hero, tier, timestamp }
 */
export async function updateUserStats(redis, userId, username, providerId, rollData) {
  const { iq, height, hero, tier, timestamp } = rollData;
  const heightInches = heightToInches(height);
  
  try {
    // Get existing stats or create new
    const userKey = `dailyroll:user:${userId}`;
    const existingStats = await redis.hgetall(userKey) || {};
    
    // Parse existing numeric values
    const totalRolls = parseInt(existingStats.totalRolls || 0) + 1;
    const sumIQ = parseInt(existingStats.sumIQ || 0) + iq;
    const sumHeightInches = parseInt(existingStats.sumHeightInches || 0) + heightInches;
    
    // Track all-time bests
    const highestIQ = Math.max(parseInt(existingStats.highestIQ || 0), iq);
    const tallestHeightInches = Math.max(parseInt(existingStats.tallestHeightInches || 0), heightInches);
    
    // Update tier counts
    const tierField = `tier${tier}Count`;
    const tierCount = parseInt(existingStats[tierField] || 0) + 1;
    
    // Track rolls per stream for cooldown
    const currentStreamKey = await getStreamKey(redis, providerId);
    const lastStreamKey = existingStats.lastStreamKey || '';
    const rollsThisStream = (currentStreamKey === lastStreamKey) 
      ? parseInt(existingStats.rollsThisStream || 0) + 1 
      : 1;
    
    // Build updated stats
    const updatedStats = {
      username,
      totalRolls,
      
      // Current roll
      currentIQ: iq,
      currentHeight: height,
      currentHero: hero,
      currentTier: tier,
      currentTimestamp: timestamp,
      
      // All-time bests
      highestIQ,
      highestIQTimestamp: highestIQ === iq ? timestamp : (existingStats.highestIQTimestamp || timestamp),
      tallestHeight: highestIQ === tallestHeightInches ? height : (existingStats.tallestHeight || height),
      tallestHeightInches,
      tallestHeightTimestamp: tallestHeightInches === heightInches ? timestamp : (existingStats.tallestHeightTimestamp || timestamp),
      
      // Aggregates
      sumIQ,
      sumHeightInches,
      
      // Tier counts
      tier1Count: parseInt(existingStats.tier1Count || 0) + (tier === 1 ? 1 : 0),
      tier2Count: parseInt(existingStats.tier2Count || 0) + (tier === 2 ? 1 : 0),
      tier3Count: parseInt(existingStats.tier3Count || 0) + (tier === 3 ? 1 : 0),
      tier4Count: parseInt(existingStats.tier4Count || 0) + (tier === 4 ? 1 : 0),
      tier5Count: parseInt(existingStats.tier5Count || 0) + (tier === 5 ? 1 : 0),
      
      // Cooldown fields
      lastRoll: timestamp,
      lastStreamKey: currentStreamKey,
      rollsThisStream: rollsThisStream,
      spamCount: 0  // Reset spam count on successful roll
    };
    
    // Save updated stats
    await redis.hset(userKey, updatedStats);
    
    // Update stream-specific leaderboards
    await updateLeaderboards(redis, userId, providerId, rollData, updatedStats);
    
    // Store username lookup for leaderboard display
    await redis.set(`dailyroll:username:${userId}`, username);
    
    console.log(`✅ Stats updated for ${username} (${userId}): ${totalRolls} total rolls`);
    
    return updatedStats;
  } catch (error) {
    console.error('❌ Error updating user stats:', error);
    // Log and continue - don't fail the roll if stats update fails
    return null;
  }
}

/**
 * Update stream-specific leaderboards
 * @param {Redis} redis - Upstash Redis client
 * @param {string} userId - User's provider ID
 * @param {string} providerId - Streamer's provider ID for stream key
 * @param {Object} rollData - { iq, height, hero, tier, timestamp }
 * @param {Object} stats - Current user stats after update
 */
export async function updateLeaderboards(redis, userId, providerId, rollData, stats) {
  try {
    const { iq, height } = rollData;
    const heightInches = heightToInches(height);
    
    // Get stream-specific key
    const streamKey = await getStreamKey(redis, providerId);
    
    console.log(`📊 Updating stream leaderboards (${streamKey}) for userId=${userId}:`);
    console.log(`  - IQ: ${iq}`);
    console.log(`  - Height: ${heightInches} inches`);
    
    // Update stream-specific sorted sets with current roll data
    const results = await Promise.all([
      redis.zadd(`dailyroll:leaderboard:${streamKey}:iq`, { score: iq, member: userId.toString() }),
      redis.zadd(`dailyroll:leaderboard:${streamKey}:height`, { score: heightInches, member: userId.toString() }),
      redis.zadd(`dailyroll:leaderboard:${streamKey}:iq_low`, { score: iq, member: userId.toString() }) // For !b500
    ]);
    
    console.log(`✅ Stream leaderboards updated (${streamKey}), zadd results:`, results);
  } catch (error) {
    console.error('❌ Error updating leaderboards:', error);
    // Log and continue
  }
}

/**
 * Get user stats
 * @param {Redis} redis - Upstash Redis client
 * @param {string} userId - User's provider ID
 * @returns {Object|null} User stats or null if not found
 */
export async function getUserStats(redis, userId) {
  try {
    const userKey = `dailyroll:user:${userId}`;
    const stats = await redis.hgetall(userKey);
    
    if (!stats || Object.keys(stats).length === 0) {
      return null;
    }
    
    // Parse numeric fields
    return {
      ...stats,
      totalRolls: parseInt(stats.totalRolls || 0),
      currentIQ: parseInt(stats.currentIQ || 0),
      currentTier: parseInt(stats.currentTier || 0),
      highestIQ: parseInt(stats.highestIQ || 0),
      tallestHeightInches: parseInt(stats.tallestHeightInches || 0),
      sumIQ: parseInt(stats.sumIQ || 0),
      sumHeightInches: parseInt(stats.sumHeightInches || 0),
      tier1Count: parseInt(stats.tier1Count || 0),
      tier2Count: parseInt(stats.tier2Count || 0),
      tier3Count: parseInt(stats.tier3Count || 0),
      tier4Count: parseInt(stats.tier4Count || 0),
      tier5Count: parseInt(stats.tier5Count || 0)
    };
  } catch (error) {
    console.error('❌ Error getting user stats:', error);
    return null;
  }
}

/**
 * Get user's ranks across all leaderboards
 * @param {Redis} redis - Upstash Redis client
 * @param {string} userId - User's provider ID
 * @returns {Object} { iqRank, heightRank, rollsRank, pepegaRank }
 */
export async function getLeaderboardRanks(redis, userId) {
  try {
    const [iqRank, heightRank, rollsRank, pepegaRank] = await Promise.all([
      redis.zrevrank('dailyroll:leaderboard:iq', userId),
      redis.zrevrank('dailyroll:leaderboard:height', userId),
      redis.zrevrank('dailyroll:leaderboard:rolls', userId),
      redis.zrank('dailyroll:leaderboard:pepega', userId) // Note: regular rank for pepega (lower score = worse)
    ]);
    
    return {
      iqRank: iqRank !== null ? iqRank + 1 : null, // Convert 0-indexed to 1-indexed
      heightRank: heightRank !== null ? heightRank + 1 : null,
      rollsRank: rollsRank !== null ? rollsRank + 1 : null,
      pepegaRank: pepegaRank !== null ? pepegaRank + 1 : null
    };
  } catch (error) {
    console.error('❌ Error getting leaderboard ranks:', error);
    return { iqRank: null, heightRank: null, rollsRank: null, pepegaRank: null };
  }
}

/**
 * Format stats response for Twitch chat
 * Max length: 450 characters (safe buffer from 500 limit)
 * @param {string} username - User's display name
 * @param {Object} stats - User stats from getUserStats()
 * @param {Object} ranks - Leaderboard ranks from getLeaderboardRanks()
 * @returns {string} Formatted stats string
 */
export function formatStatsResponse(username, stats, ranks) {
  if (!stats || stats.totalRolls === 0) {
    return `${username}: No rolls yet! Type !roll to get started.`;
  }
  
  // Build response parts with more personality
  const rollCount = `${stats.totalRolls} attempt${stats.totalRolls === 1 ? '' : 's'} 🎲`;
  const current = `Latest: ${stats.currentIQ} IQ, ${stats.currentHeight}, ${stats.currentHero}`;
  const peak = `Peak: ${stats.highestIQ} IQ 🧠, ${stats.tallestHeight} 📏`;
  
  // Build ranks string (only show ranks that exist)
  const rankParts = [];
  if (ranks.iqRank) rankParts.push(`#${ranks.iqRank} IQ`);
  if (ranks.heightRank) rankParts.push(`#${ranks.heightRank} height`);
  if (ranks.pepegaRank) rankParts.push(`#${ranks.pepegaRank} pepega`);
  const rankString = rankParts.length > 0 ? ` | Ranks: ${rankParts.join(', ')} ✨` : '';
  
  // Add some snarky commentary based on performance
  let commentary = '';
  const avgIQ = stats.totalRolls > 0 ? stats.sumIQ / stats.totalRolls : 0;
  
  if (stats.totalRolls >= 10) {
    if (avgIQ >= 150) {
      commentary = ' | The brain trust approves 👑';
    } else if (avgIQ <= 50) {
      commentary = ' | Living their best chaotic life 🌪️';
    } else if (ranks.pepegaRank && ranks.pepegaRank <= 10) {
      commentary = ' | Certified pepega energy 🐸';
    } else if (stats.totalRolls >= 50) {
      commentary = ' | The dedication is real 💪';
    }
  }
  
  return `${username}'s fortune: ${rollCount} | ${current} | ${peak}${rankString}${commentary}`;
}

/**
 * Get top N entries from a leaderboard
 * @param {Redis} redis - Upstash Redis client
 * @param {string} leaderboardKey - Redis sorted set key
 * @param {number} n - Number of entries to retrieve
 * @param {boolean} reverse - If true, get highest scores (default). If false, get lowest.
 * @returns {Array} Array of { username, score, rank }
 */
export async function getTopN(redis, leaderboardKey, n = 5, reverse = true) {
  try {
    console.log(`🔍 Getting top ${n} from ${leaderboardKey}, reverse=${reverse}`);
    
    // Get top N user IDs with scores using Upstash Redis API
    const results = await redis.zrange(leaderboardKey, 0, n - 1, { 
      withScores: true,
      rev: reverse  // rev: true for highest to lowest (reverse order)
    });
    
    console.log(`📊 Redis returned ${results ? results.length : 0} items:`, results);
    
    if (!results || results.length === 0) {
      console.log('⚠️ No results found');
      return [];
    }
    
    // Results come back as [userId, score, userId, score, ...]
    const entries = [];
    for (let i = 0; i < results.length; i += 2) {
      const userId = results[i];
      const score = results[i + 1];
      
      // Get username
      const username = await redis.get(`dailyroll:username:${userId}`);
      
      entries.push({
        username: username || 'Unknown',
        score,
        rank: Math.floor(i / 2) + 1
      });
    }
    
    return entries;
  } catch (error) {
    console.error('❌ Error getting leaderboard entries:', error);
    return [];
  }
}

/**
 * Format leaderboard response for Twitch chat
 * @param {string} type - Leaderboard type ('iq', 'height', 'rolls')
 * @param {Array} entries - Array of { username, score, rank }
 * @returns {string} Formatted leaderboard string
 */
export function formatLeaderboardResponse(type, entries) {
  if (!entries || entries.length === 0) {
    return '🏆 No leaderboard data yet! Be the first to roll.';
  }
  
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  
  // Emoji and label by type with more personality
  const labels = {
    iq: { emoji: '🧠', label: 'Brainiac Brigade', subtitle: 'The sharpest minds in the house' },
    height: { emoji: '📏', label: 'Height Champions', subtitle: 'Standing tall above the rest' },
    rolls: { emoji: '🎲', label: 'Roll Veterans', subtitle: 'The true gambling addicts' }
  };
  
  const config = labels[type] || { emoji: '🏆', label: 'Top 5', subtitle: 'The elite few' };
  
  // Format entries with medals
  const formattedEntries = entries.map((entry, index) => {
    let scoreDisplay = entry.score;
    
    // Special formatting for height (convert inches to feet'inches")
    if (type === 'height') {
      const feet = Math.floor(entry.score / 12);
      const inches = entry.score % 12;
      scoreDisplay = `${feet}'${inches}"`;
    }
    
    const medal = medals[index] || '•';
    return `${medal} ${entry.username} (${scoreDisplay})`;
  }).join(' | ');
  
  return `${config.emoji} ${config.label}: ${formattedEntries} | ${config.subtitle} 🏅`;
}

/**
 * Format pepega (lowest IQ) leaderboard response for Twitch chat
 * @param {Array} entries - Array of { username, score, rank }
 * @returns {string} Formatted pepega leaderboard string
 */
export function formatPepegaResponse(entries) {
  if (!entries || entries.length === 0) {
    return '💩 No leaderboard data yet! Be the first to roll.';
  }
  
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  
  // Format entries with actual IQ scores (ironic medals for lowest IQ)
  const formattedEntries = entries.map((entry, index) => {
    const iqScore = Math.round(parseFloat(entry.score)); // IQ is the score now
    const medal = medals[index] || '•';
    return `${medal} ${entry.username} (${iqScore})`;
  }).join(' | ');
  
  return `� Pepega Hall of Shame: ${formattedEntries} | When RNG says "no" 💀`;
}
