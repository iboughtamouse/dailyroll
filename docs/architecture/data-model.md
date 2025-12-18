# Data Model

## Overview

This document describes the Redis data model for the Daily Roll API.

## Current State (v1.0)

### User Cooldown Data
```
Key: dailyroll:<userId>
Type: Hash
TTL: 48 hours
Value: {
  lastRoll: <timestamp>,
  spamCount: <integer>
}
```

### Cached Data
```
Key: twitch:app_token
Type: String
TTL: 50 days
Value: <access_token>

Key: stream:<providerId>:start_time
Type: String
TTL: 5 minutes
Value: <ISO timestamp>
```

## Planned State (v2.0 - Stats & Leaderboards)

### User Stats & History
```
Key: dailyroll:user:<userId>
Type: Hash
TTL: Never (persistent)
Fields: {
  username: String,
  totalRolls: Integer,
  
  // Current roll (for display)
  currentIQ: Integer,
  currentHeight: String,
  currentHero: String,
  currentTier: Integer,
  currentTimestamp: Integer,
  
  // All-time bests
  highestIQ: Integer,
  highestIQTimestamp: Integer,
  tallestHeight: String,
  tallestHeightInches: Integer,
  tallestHeightTimestamp: Integer,
  
  // Aggregates for calculating averages
  sumIQ: Integer,
  sumHeightInches: Integer,
  
  // Tier distribution
  tier1Count: Integer,
  tier2Count: Integer,
  tier3Count: Integer,
  tier4Count: Integer,
  tier5Count: Integer,
  
  // Cooldown (migrated from old schema)
  lastRoll: Integer,
  spamCount: Integer
}
```

### Global Leaderboards
```
Key: dailyroll:leaderboard:iq
Type: Sorted Set
Score: Highest IQ achieved
Member: <userId>

Key: dailyroll:leaderboard:height
Type: Sorted Set
Score: Tallest height in inches
Member: <userId>

Key: dailyroll:leaderboard:rolls
Type: Sorted Set
Score: Total number of rolls
Member: <userId>

Key: dailyroll:leaderboard:pepega
Type: Sorted Set
Score: Pepega score (lower = more pepega)
Member: <userId>
```

### Username Lookup
```
Key: dailyroll:username:<userId>
Type: String
TTL: Never
Value: <username>

Purpose: Efficiently get usernames for leaderboard display without fetching full user hash
```

## Storage Estimates

### Per User (v2.0)
- User hash: ~500 bytes (20 fields @ ~25 bytes each)
- Leaderboard entries: 4 × 24 bytes = 96 bytes
- Username lookup: ~50 bytes
- **Total per user: ~650 bytes**

### Capacity
- Upstash free tier: 256 MB
- Users supported: ~400,000 users (won't reach this)
- Expected usage (1000 active users): ~650 KB

### Daily Command Usage
- Daily roll: 1 GET + 1 SET + 4 ZADD = 6 commands per roll
- Stats query: 1 HGETALL + 4 ZRANK = 5 commands
- Leaderboard query: 1 ZREVRANGE + 5 HGET = 6 commands
- Expected daily: ~500 rolls + 100 stats + 50 leaderboards = ~4,000 commands
- Upstash free tier limit: 10,000 commands/day
- **Well within limits**

## Migration Strategy

When deploying stats feature (v2.0):
1. Run `FLUSHDB` in Upstash dashboard before deployment
2. Fresh start for all users (no cooldowns, no stats)
3. Everyone can roll immediately after deployment
4. Leaderboards start from scratch

**What gets cleared:**
- All user cooldown data
- Cached Twitch tokens (regenerate automatically)
- Cached stream start times (regenerate in 5 minutes)

**Impact:** Minimal - users who were on cooldown can roll right away (bonus), caches rebuild automatically on first request.

**Why FLUSHDB:** Simpler than schema migration, true fresh start for leaderboards, no migration code needed.
