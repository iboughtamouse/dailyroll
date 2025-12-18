// Stats management utilities for Daily Roll
// Handles user stats tracking and leaderboard updates

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
 * @param {Object} rollData - { iq, height, hero, tier, timestamp }
 */
export async function updateUserStats(redis, userId, username, rollData) {
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
      
      // Cooldown fields (preserve existing)
      lastRoll: existingStats.lastRoll || timestamp,
      spamCount: existingStats.spamCount || 0
    };
    
    // Save updated stats
    await redis.hset(userKey, updatedStats);
    
    // Update leaderboards
    await updateLeaderboards(redis, userId, rollData, updatedStats);
    
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
 * Update global leaderboards
 * @param {Redis} redis - Upstash Redis client
 * @param {string} userId - User's provider ID
 * @param {Object} rollData - { iq, height, hero, tier, timestamp }
 * @param {Object} stats - Current user stats after update
 */
export async function updateLeaderboards(redis, userId, rollData, stats) {
  try {
    const { iq, height } = rollData;
    const heightInches = heightToInches(height);
    const pepegaScore = calculatePepegaScore(stats);
    
    // Update sorted sets (higher scores = better rank, except pepega where lower = worse)
    await Promise.all([
      redis.zadd('dailyroll:leaderboard:iq', { score: iq, member: userId }),
      redis.zadd('dailyroll:leaderboard:height', { score: heightInches, member: userId }),
      redis.zadd('dailyroll:leaderboard:rolls', { score: stats.totalRolls, member: userId }),
      redis.zadd('dailyroll:leaderboard:pepega', { score: pepegaScore, member: userId })
    ]);
    
    console.log(`📊 Leaderboards updated for ${userId}`);
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
    return `${username}: No rolls yet! Type !dailyroll to get started.`;
  }
  
  // Build response parts
  const rollCount = `${stats.totalRolls} roll${stats.totalRolls === 1 ? '' : 's'}`;
  const current = `Today: ${stats.currentIQ} IQ, ${stats.currentHeight}, ${stats.currentHero}`;
  const peak = `Peak: ${stats.highestIQ} IQ, ${stats.tallestHeight}`;
  
  // Build ranks string (only show ranks that exist)
  const rankParts = [];
  if (ranks.iqRank) rankParts.push(`#${ranks.iqRank} IQ`);
  if (ranks.heightRank) rankParts.push(`#${ranks.heightRank} height`);
  if (ranks.pepegaRank) rankParts.push(`#${ranks.pepegaRank} pepega`);
  const rankString = rankParts.length > 0 ? ` | Rank: ${rankParts.join(', ')}` : '';
  
  return `${username}: ${rollCount} | ${current} | ${peak}${rankString}`;
}
