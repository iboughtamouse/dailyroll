// Daily Roll API for Fossabot (Redis Version)
// Returns random IQ, height, and hero with per-stream cooldown (when live) or 24-hour cooldown (when offline)

import { Redis } from "@upstash/redis";
import { getStreamStartTime } from "./lib/twitch.js";
import {
  generateIQ,
  generateHeight,
  generateHero,
  getRandomInsult,
  formatRollResponse,
} from "./lib/game.js";
import { updateUserStats, getStreamKey } from "./lib/stats.js";
import { validateAndGetContext } from "./lib/fossabot.js";

// Max rolls per stream (configurable for testing)
const MAX_ROLLS_PER_STREAM = parseInt(process.env.MAX_ROLLS_PER_STREAM || '1', 10);

/**
 * Main handler
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle OPTIONS request
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Get the Fossabot token from headers
  const token = req.headers["x-fossabot-customapitoken"];

  // Get twitch channel name
  const isAugust =
    `${req.headers["x-fossabot-channeldisplayname"]}`.toUpperCase() ===
    process.env.STREAMER_NAME;

  if (!token) {
    res.status(400).send("Missing Fossabot token");
    return;
  }

  if (!isAugust) {
    res.status(403).send("Get out of my fucking API you shitter");
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
  const username =
    context.message?.user?.display_name ||
    context.message?.user?.login ||
    "Unknown";
  const userId = context.message?.user?.provider_id;
  const channelProviderId = context.channel?.provider_id;
  const isLive = context.channel?.is_live || false;

  if (!userId) {
    res.status(400).send("Could not identify user");
    return;
  }

  if (!channelProviderId) {
    res.status(400).send("Could not identify channel");
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
      console.error("Error fetching stream start time:", error);
      // Continue without stream start time - will fall back to 24-hour cooldown
    }
  }

  // Check if user has rolled before
  const now = Date.now();
  const userKey = `dailyroll:user:${userId}`;
  const userData = await redis.hgetall(userKey);

  // Log current state for monitoring
  console.log("=== DAILYROLL REQUEST ===");
  console.log("User:", username);
  console.log("Current time:", new Date(now).toISOString());
  console.log("Is live:", isLive);
  console.log(
    "Stream start time:",
    streamStartTime ? new Date(streamStartTime).toISOString() : "N/A"
  );

  if (streamStartTime) {
    const minutesSinceStreamStart = Math.round(
      (now - streamStartTime) / 1000 / 60
    );
    console.log("Minutes since stream start:", minutesSinceStreamStart);
  }

  if (userData && userData.lastRoll) {
    console.log("Last roll:", new Date(userData.lastRoll).toISOString());
    const minutesSinceLastRoll = Math.round(
      (now - userData.lastRoll) / 1000 / 60
    );
    console.log("Minutes since last roll:", minutesSinceLastRoll);
    console.log("Current spam count:", userData.spamCount || 0);
  } else {
    console.log("No previous roll data");
  }

  // Determine if user is in cooldown
  let inCooldown = false;
  let cooldownReason = "";

  if (userData && userData.lastRoll) {
    if (isLive && streamStartTime) {
      // LIVE: Check if they've exceeded max rolls for this stream
      try {
        const currentStreamKey = await getStreamKey(redis, channelProviderId);
        const lastStreamKey = userData.lastStreamKey || '';
        const rollsThisStream = (currentStreamKey === lastStreamKey) ? (parseInt(userData.rollsThisStream || 0)) : 0;
        
        inCooldown = rollsThisStream >= MAX_ROLLS_PER_STREAM;
        cooldownReason = inCooldown
          ? `Already used ${rollsThisStream}/${MAX_ROLLS_PER_STREAM} rolls this stream`
          : `Rolls this stream: ${rollsThisStream}/${MAX_ROLLS_PER_STREAM}`;
      } catch (error) {
        console.error('❌ Error getting stream key for cooldown check:', error);
        // Fall back to 24-hour cooldown if stream key fails
        const OFFLINE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
        const timeSinceLastRoll = now - userData.lastRoll;
        inCooldown = timeSinceLastRoll < OFFLINE_COOLDOWN_MS;
        cooldownReason = inCooldown
          ? `Stream key error - using 24-hour cooldown (${Math.round(timeSinceLastRoll / 1000 / 60)} minutes ago)`
          : `Stream key error - 24-hour cooldown expired`;
      }
    } else {
      // OFFLINE or couldn't get stream start time: Use 24-hour cooldown
      const OFFLINE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
      const timeSinceLastRoll = now - userData.lastRoll;
      inCooldown = timeSinceLastRoll < OFFLINE_COOLDOWN_MS;
      cooldownReason = inCooldown
        ? `Within 24-hour offline cooldown (${Math.round(
            timeSinceLastRoll / 1000 / 60
          )} minutes ago)`
        : `24-hour cooldown expired`;
    }
  }

  console.log("In cooldown:", inCooldown);
  console.log("Reason:", cooldownReason);
  console.log("========================");

  if (inCooldown) {
    // User is in cooldown - track spam and respond
    const spamCount = (userData.spamCount || 0) + 1;

    console.log("❌ Cooldown active - spam count:", spamCount);

    // Update spam count in user hash
    await redis.hset(userKey, {
      spamCount: spamCount
    });

    const insult = getRandomInsult();

    // If they've tried 2+ times, issue a timeout command (return 'timeout ...' so Fossabot will prefix with '/')
    if (spamCount >= 2) {
      console.log("⏱️ Timeout triggered (spam count >= 2)");
      const timeoutMessage = `timeout ${username} 60s ${insult}`;
      console.log("📤 RESPONSE (TIMEOUT):", JSON.stringify(timeoutMessage));
      console.log("📤 RESPONSE LENGTH:", timeoutMessage.length);
      console.log(
        "📤 RESPONSE BYTES:",
        Buffer.from(timeoutMessage).toString("hex")
      );
      res.status(200).send(timeoutMessage);
      return;
    }

    // Otherwise respond with an emote-style message so Fossabot will output '/me ...'
    const insultResponse = `me ${insult}`;
    console.log("💬 Sending insult (spam count < 2)");
    console.log("📤 RESPONSE (INSULT):", JSON.stringify(insultResponse));
    console.log("📤 RESPONSE LENGTH:", insultResponse.length);
    res.status(200).send(insultResponse);
    return;
  }

  // Generate new roll
  const iq = generateIQ();
  const height = generateHeight();
  const heroData = generateHero(iq, height);

  console.log("✅ Successful roll - generating new stats");
  console.log(
    `Generated: IQ ${iq}, Height ${height}, Hero ${heroData.hero} (Tier ${heroData.tier})`
  );

  // Update user stats and leaderboards
  const statsUpdateResult = await updateUserStats(redis, userId, username, channelProviderId, {
    iq,
    height,
    hero: heroData.hero,
    tier: heroData.tier,
    timestamp: now
  });

  // Fail the request if stats update fails to prevent data inconsistency
  if (!statsUpdateResult) {
    console.error('❌ Failed to update stats - aborting roll');
    res.status(500).send('Error processing roll. Please try again.');
    return;
  }

  console.log('✅ Stats updated successfully');

  // Format and return response
  let response = `me ${formatRollResponse(username, iq, height, heroData)}`;
  console.log("📤 RESPONSE (SUCCESS):", JSON.stringify(response));
  console.log("📤 RESPONSE LENGTH:", response.length);
  res.status(200).send(response);
}
