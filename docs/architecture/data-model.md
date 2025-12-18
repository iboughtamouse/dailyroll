# Data Model

## Overview

This document describes the Redis data model for the Daily Roll API.

## Current State (Production)

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
  
      // Cooldown tracking
      lastRoll: Integer,
      lastStreamKey: String,       // e.g., "stream_2025-12-18T12:34:56Z"
      rollsThisStream: Integer,    // Count of rolls in current stream
      spamCount: Integer
    }
    ```

### Stream-Based Leaderboards
```
Key: dailyroll:leaderboard:stream_<timestamp>:iq
Type: Sorted Set
Score: Highest IQ achieved this stream
Member: <userId>

Key: dailyroll:leaderboard:stream_<timestamp>:height
Type: Sorted Set
Score: Tallest height in inches this stream
Member: <userId>

Key: dailyroll:leaderboard:stream_<timestamp>:iq_low
Type: Sorted Set
Score: Lowest IQ (for bottom rankings)
Member: <userId>

Example: dailyroll:leaderboard:stream_2025-12-18T12:34:56Z:iq

Note: Leaderboards reset each stream using Twitch stream start time as unique key.
All leaderboards are per-stream, not all-time.
### Username Lookup
```
Key: dailyroll:username:<userId>
Type: String
TTL: Never
Value: <username>

Purpose: Efficiently get usernames for leaderboard display without fetching full user hash
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

## Storage Estimates

### Per User
- User hash: ~600 bytes (24 fields including cooldown tracking)
- Leaderboard entries per stream: 3 × 24 bytes = 72 bytes
- Username lookup: ~50 bytes
- **Total per user: ~720 bytes**

### Capacity
- Upstash free tier: 256 MB
- Users supported: ~350,000 users (won't reach this)
- Expected usage (1000 active users): ~720 KB

### Per Stream
- 3 leaderboards × 1000 users × 24 bytes = ~72 KB per stream
- Old stream leaderboards are not automatically cleaned up
- Manual cleanup recommended periodically (delete old stream_* keys)

### Daily Command Usage
- Daily roll: 1 HGETALL + 1 HSET + 3 ZADD = 5 commands per roll
- Stats query: 1 HGETALL + 3 ZRANK = 4 commands
- Leaderboard query: 1 ZRANGE + 5 GET = 6 commands
- Expected daily: ~500 rolls + 100 stats + 50 leaderboards = ~4,500 commands
- Upstash free tier limit: 10,000 commands/day
- **Well within limits**

## Configuration

### Roll Limits
- `MAX_ROLLS_PER_STREAM` environment variable (default: 1)
- Tracks rolls per stream using `lastStreamKey` and `rollsThisStream` fields
- Resets automatically when new stream starts (different stream key)

### Leaderboard Behavior
- Leaderboards are stream-specific and reset each broadcast
- Uses Twitch API stream start time as unique session identifier
- No automatic cleanup of old stream leaderboards (manual FLUSHDB or key deletion needed)
