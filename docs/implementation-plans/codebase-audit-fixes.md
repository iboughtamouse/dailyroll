# Codebase Audit Fixes - Implementation Plan

**Created:** December 30, 2025  
**Status:** Planning  
**Priority:** Medium  

## Overview
Address technical debt and bugs identified in codebase audit. Fixes improve code quality, consistency, and user-facing functionality.

---

## 1. Address Code Duplication

**Issue:** `validateAndGetContext()` function is duplicated in 4 files:
- `api/dailyroll.js`
- `api/stats/me.js`
- `api/stats/leaderboard.js`
- `api/stats/pepega.js`

**Solution:**
1. Create `api/lib/fossabot.js` with shared validation logic
2. Export `validateAndGetContext(token)` function
3. Update all 4 files to import from shared module

**Implementation:**
```javascript
// api/lib/fossabot.js
/**
 * Validate the Fossabot request and get context
 * @param {string} token - Fossabot custom API token
 * @returns {Promise<{valid: boolean, data?: object, error?: string}>}
 */
export async function validateAndGetContext(token) {
  const response = await fetch(
    `https://api.fossabot.com/v2/customapi/context/${token}`
  );

  if (!response.ok) {
    return { valid: false, error: "Invalid or expired token" };
  }

  const data = await response.json();
  return { valid: true, data };
}
```

**Files to Update:**
- Create: `api/lib/fossabot.js`
- Modify: `api/dailyroll.js`, `api/stats/me.js`, `api/stats/leaderboard.js`, `api/stats/pepega.js`
- Change import from local function to: `import { validateAndGetContext } from './lib/fossabot.js'`

**Effort:** 30 minutes  
**Risk:** Low (simple refactor, no logic changes)

---

## 2. Consistent Channel Gating

**Issue:** Inconsistent channel validation across endpoints:
- `dailyroll.js` - checks channel, returns 400
- `stats/me.js` - **NO channel gating**
- `stats/leaderboard.js` - checks channel, returns 403
- `stats/pepega.js` - checks channel, returns 403

**Decision Required:**
Should all endpoints require channel gating, or is `me.js` intentionally public?

**Recommended Solution:**
Add channel gating to `me.js` for consistency. Personal stats should only be accessible from the streamer's channel.

**Implementation:**
```javascript
// In api/stats/me.js, after context extraction
const channelName = context.channel?.display_name?.toUpperCase();
const expectedChannel = process.env.STREAMER_NAME?.toUpperCase();

if (channelName !== expectedChannel) {
  console.log(`❌ Channel mismatch: ${channelName} !== ${expectedChannel}`);
  res.status(403).send('This command is not available in this channel');
  return;
}
```

**Also Fix:** Standardize response status codes
- All channel mismatch errors should return `403 Forbidden`
- Update `dailyroll.js` from 400 to 403

**Files to Update:**
- Modify: `api/stats/me.js` (add channel gating)
- Modify: `api/dailyroll.js` (change 400 to 403 for channel mismatch)

**Effort:** 15 minutes  
**Risk:** Low (adds security)

---

## 3. REDIS_EXPIRATION - Remove or Use

**Issue:** `REDIS_EXPIRATION = 48 * 60 * 60` defined but never used in `api/dailyroll.js`

**Investigation:**
- Added in commit `c6f0125` (stats tracking phase 1)
- Originally intended for TTL on user data Redis keys
- Currently, user data persists indefinitely in Redis

**Decision Required:**
Should user data expire after 48 hours of inactivity?

**Option A: Remove** (Recommended)
User stats should persist indefinitely. Remove unused constant.

**Option B: Use**
Add TTL to user data keys to auto-cleanup inactive users after 48 hours.

```javascript
// In updateUserStats() after hset
await redis.expire(userKey, REDIS_EXPIRATION);
```

**Recommendation:** **Remove**. User stats are valuable long-term data. No reason to expire them.

**Files to Update:**
- Modify: `api/dailyroll.js` (remove line 16)

**Effort:** 2 minutes  
**Risk:** None

---

## 4. Fix getLeaderboardRanks() - Stream-Specific Ranks (Option A)

**Issue:** `getLeaderboardRanks()` queries non-existent global leaderboards:
- Queries: `dailyroll:leaderboard:iq`, `dailyroll:leaderboard:height`, etc.
- Actual keys: `dailyroll:leaderboard:stream_X:iq`, `dailyroll:leaderboard:stream_X:height`
- Result: Ranks always null, never displayed in !stats output

**Solution:** Update to use stream-specific leaderboards

**Implementation:**

```javascript
/**
 * Get user's ranks in stream-specific leaderboards
 * @param {Redis} redis - Upstash Redis client
 * @param {string} userId - User's provider ID
 * @param {string} providerId - Streamer's provider ID for stream key
 * @returns {Object} { iqRank, heightRank, iqLowRank }
 */
export async function getLeaderboardRanks(redis, userId, providerId) {
  try {
    const streamKey = await getStreamKey(redis, providerId);
    
    const [iqRank, heightRank, iqLowRank] = await Promise.all([
      redis.zrevrank(`dailyroll:leaderboard:${streamKey}:iq`, userId),
      redis.zrevrank(`dailyroll:leaderboard:${streamKey}:height`, userId),
      redis.zrank(`dailyroll:leaderboard:${streamKey}:iq_low`, userId)
    ]);
    
    return {
      iqRank: iqRank !== null ? iqRank + 1 : null,
      heightRank: heightRank !== null ? heightRank + 1 : null,
      iqLowRank: iqLowRank !== null ? iqLowRank + 1 : null
    };
  } catch (error) {
    console.error('❌ Error getting leaderboard ranks:', error);
    return { iqRank: null, heightRank: null, iqLowRank: null };
  }
}
```

**Update function signature in stats.js and me.js:**
```javascript
// In api/stats/me.js
const channelProviderId = context.channel?.provider_id;
const ranks = await getLeaderboardRanks(redis, userId, channelProviderId);
```

**Update formatStatsResponse():**
```javascript
// Update to show "This Stream" context
const rankParts = [];
if (ranks.iqRank) rankParts.push(`#${ranks.iqRank} IQ`);
if (ranks.heightRank) rankParts.push(`#${ranks.heightRank} height`);
if (ranks.iqLowRank) rankParts.push(`#${ranks.iqLowRank} pepega`);
const rankString = rankParts.length > 0 ? ` | This Stream: ${rankParts.join(', ')} 🌟` : '';
```

**Expected Output:**
```
webdevin: 11 attempts 🎲 | Latest: 50 IQ, 9'7", Hanzo | Peak: 172 IQ, 0'1" 🧠 | This Stream: #3 IQ, #8 height 🌟
```

**Files to Update:**
- Modify: `api/lib/stats.js` - update `getLeaderboardRanks()` signature and logic
- Modify: `api/lib/stats.js` - update `formatStatsResponse()` to show "This Stream"
- Modify: `api/stats/me.js` - pass `channelProviderId` to `getLeaderboardRanks()`

**Effort:** 45 minutes  
**Risk:** Medium (requires testing to ensure ranks display correctly)

---

## 5. Fix tallestHeight Logic Bug

**Issue:** `api/lib/stats.js` line 111 has wrong comparison:
```javascript
tallestHeight: highestIQ === tallestHeightInches ? height : (existingStats.tallestHeight || height),
```

Should be:
```javascript
tallestHeight: tallestHeightInches === heightInches ? height : (existingStats.tallestHeight || height),
```

**Impact:** `tallestHeight` (formatted string like "9'11"") not updating correctly when user hits new peak.

**Solution:** Fix the comparison logic

**Files to Update:**
- Modify: `api/lib/stats.js` line 111

**Effort:** 2 minutes  
**Risk:** None (pure bug fix)

---

## 6. Error Handling for getStreamKey()

**Issue:** If `getStreamKey()` throws an error, cooldown logic may fail silently. Function has try/catch but returns offline fallback, which could cause issues.

**Current Behavior:**
```javascript
// In getStreamKey()
catch (error) {
  console.error('Error getting stream start time:', error);
}
// Falls through to offline key generation
```

**Problem:** If Twitch API is down during a live stream, it falls back to offline key, breaking stream-specific cooldowns.

**Solution:** Add explicit error handling in cooldown check

```javascript
// In api/dailyroll.js
if (isLive && streamStartTime) {
  try {
    const currentStreamKey = await getStreamKey(redis, channelProviderId);
    // ... existing logic
  } catch (error) {
    console.error('❌ Error getting stream key for cooldown check:', error);
    // Fall back to 24-hour cooldown if stream key fails
    const OFFLINE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
    const timeSinceLastRoll = now - userData.lastRoll;
    inCooldown = timeSinceLastRoll < OFFLINE_COOLDOWN_MS;
    cooldownReason = 'Stream key error - using 24-hour cooldown';
  }
}
```

**Files to Update:**
- Modify: `api/dailyroll.js` - add try/catch around `getStreamKey()` call

**Effort:** 20 minutes  
**Risk:** Low (improves reliability)

---

## 7. Error Recovery for updateUserStats()

**Issue:** If `updateUserStats()` fails, the roll succeeds and response is sent, but:
- User's cooldown data isn't updated
- Next roll attempt thinks they haven't rolled yet (allows duplicate rolls)
- Leaderboards don't update

**Current Behavior:**
```javascript
await updateUserStats(...); // Can fail silently
// ... continues regardless
res.status(200).send(response);
```

**Solution:** Fail the entire request if stats update fails

```javascript
const statsUpdateResult = await updateUserStats(redis, userId, username, channelProviderId, {
  iq,
  height,
  hero: heroData.hero,
  tier: heroData.tier,
  timestamp: now
});

if (!statsUpdateResult) {
  console.error('❌ Failed to update stats - aborting roll');
  res.status(500).send('Error processing roll. Please try again.');
  return;
}
```

**Alternative Solution:** Retry logic (more complex)
```javascript
let statsUpdateResult = null;
for (let attempt = 0; attempt < 3; attempt++) {
  statsUpdateResult = await updateUserStats(...);
  if (statsUpdateResult) break;
  console.warn(`⚠️ Stats update attempt ${attempt + 1} failed, retrying...`);
  await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
}

if (!statsUpdateResult) {
  console.error('❌ Failed to update stats after 3 attempts');
  res.status(500).send('Error processing roll. Please try again.');
  return;
}
```

**Recommendation:** Start with simple fail-fast approach. Add retries if issues persist in production.

**Files to Update:**
- Modify: `api/dailyroll.js` - check `updateUserStats()` result, fail request if null

**Effort:** 15 minutes (fail-fast) or 45 minutes (with retries)  
**Risk:** Low (prevents data inconsistency)

---

## Implementation Order

**Phase 1: Quick Wins (1 hour)**
1. Fix tallestHeight bug (#5) - 2 min
2. Remove REDIS_EXPIRATION (#3) - 2 min  
3. Address code duplication (#1) - 30 min
4. Consistent channel gating (#2) - 15 min
5. Error recovery for updateUserStats (#7) - 15 min

**Phase 2: Feature Fix (1 hour)**
6. Fix getLeaderboardRanks for stream-specific ranks (#4) - 45 min
7. Error handling for getStreamKey (#6) - 20 min

**Total Effort:** ~2 hours  
**Testing:** 1 hour (manual + automated)

---

## Testing Checklist

After implementation:

- [ ] All 50 existing tests pass
- [ ] `!roll` cooldown works correctly (1 per stream when live)
- [ ] `!stats` shows stream-specific ranks when user has rolled
- [ ] `!stats` works correctly when user hasn't rolled
- [ ] `!t500` and `!b500` still work
- [ ] Channel gating blocks non-matching channels on all endpoints
- [ ] Error scenarios (Twitch API down, Redis timeout) handled gracefully
- [ ] Verify tallestHeight updates correctly on new personal best

---

## Rollback Plan

All changes are backward-compatible except #4 (ranks). If ranks feature breaks:
1. Revert changes to `getLeaderboardRanks()` and `formatStatsResponse()`
2. Ranks will return to null state (no display, same as current)
3. No data loss, no breaking changes

---

## Notes

- Consider adding integration tests for Fossabot validation
- May want to monitor Redis key count growth after removing expiration
- Stream-specific ranks will reset each broadcast (this is intentional)
