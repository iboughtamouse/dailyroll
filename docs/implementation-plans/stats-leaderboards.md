# Implementation Plan: Stats & Leaderboards

## Overview

Add user statistics tracking and leaderboard functionality to the Daily Roll API, accessible via Fossabot commands.

## Goals

- Track user roll history and statistics
- Provide personal stats lookup (`!stats`)
- Provide leaderboards for top performers (`!t500`, `!top500`, `!leaderboard`)
- Provide "pepega" rankings for worst luck (`!b500`, `!bottom500`, `!pepega`)
- Keep all functionality Fossabot-gated (no public endpoints)
- Stay within Upstash free tier limits

## User Experience

### Personal Stats (`!stats`)
**Input:** User types `!stats` in chat

**Output:**
```
TestUser: 23 rolls | Today: 142 IQ, 6'3", Reinhardt | Peak: 198 IQ, 9'2" | Rank: #3 IQ, #12 height, #47 pepega
```

**Fields shown:**
- Total rolls to date
- Current roll (today's result)
- All-time peak IQ and height
- Current leaderboard ranks

### Top 500 (`!t500`, `!top500`, `!leaderboard`)
**Input:** User types any of the command aliases

**Output (rotates between types):**
```
🏆 Highest IQ: 1) Ninja (200) 2) Shroud (199) 3) Pokimane (197) 4) Ludwig (195) 5) xQc (194)

🏆 Tallest: 1) Tyler1 (9'11") 2) Greek (9'10") 3) Hasan (9'9") 4) Mizkif (9'8") 5) Sodapoppin (9'7")

🏆 Most Rolls: 1) xQc (143) 2) Forsen (127) 3) Ninja (89) 4) Ludwig (76) 5) Shroud (64)
```

**Rotation logic:** Randomly select one of three leaderboard types per request

### Bottom 500 (`!b500`, `!bottom500`, `!pepega`)
**Input:** User types any of the command aliases

**Output:**
```
💩 Most Pepega: 1) Tyler1 (score: 0.12) 2) Greek (0.18) 3) Trainwrecks (0.23) 4) Mizkif (0.27) 5) Hasan (0.31)
```

**Pepega Score Calculation:**
```javascript
// Lower score = more pepega (worse luck)
pepegas = (avgIQ / 200) * 0.4 +           // 40% weight on IQ
           (avgHeight / 119) * 0.3 +       // 30% weight on height
           (tier2+3+4+5) / totalRolls * 0.3 // 30% weight on non-hamster %

// Examples:
// Avg 25 IQ, 2'1" (25 inches), 90% hamster tier
// = (25/200)*0.4 + (25/119)*0.3 + (0.1)*0.3 = 0.05 + 0.06 + 0.03 = 0.14

// Avg 150 IQ, 7'3" (87 inches), 20% hamster tier  
// = (150/200)*0.4 + (87/119)*0.3 + (0.8)*0.3 = 0.30 + 0.22 + 0.24 = 0.76
```

## Technical Design

### New API Endpoints

#### `/api/stats/me.js`
- **Method:** GET
- **Auth:** Fossabot token required
- **Purpose:** Get personal stats for the requesting user
- **Response:** Plain text formatted for Twitch chat

#### `/api/stats/leaderboard.js`
- **Method:** GET
- **Auth:** Fossabot token required (channel-gated)
- **Purpose:** Get top 5 performers (random rotation)
- **Response:** Plain text formatted for Twitch chat

#### `/api/stats/pepega.js`
- **Method:** GET
- **Auth:** Fossabot token required (channel-gated)
- **Purpose:** Get bottom 5 performers by pepega score
- **Response:** Plain text formatted for Twitch chat

### Shared Utilities

#### `/api/lib/stats.js` (new file)
Functions for stats management:
- `updateUserStats(redis, userId, username, rollData)` - Update user stats after roll
- `updateLeaderboards(redis, userId, rollData, stats)` - Update sorted sets
- `getUserStats(redis, userId)` - Get user stats hash
- `getLeaderboardRanks(redis, userId)` - Get user's ranks across leaderboards
- `calculatePepegaScore(stats)` - Calculate pepega score from user stats
- `formatStatsResponse(username, stats, ranks)` - Format stats for chat
- `formatLeaderboardResponse(type, entries)` - Format leaderboard for chat
- `getTopN(redis, leaderboardKey, n)` - Get top N from sorted set with usernames

### Modified Files

#### `/api/dailyroll.js`
After generating a new roll, add stats tracking:
```javascript
// Existing roll generation code...
const iq = generateIQ();
const height = generateHeight();
const heroData = generateHero(iq, height);

// NEW: Update user stats
await updateUserStats(redis, userId, username, {
  iq,
  height,
  hero: heroData.hero,
  tier: heroData.tier,
  timestamp: now
});

// Rest of existing code...
```

## Implementation Phases

### Phase 1: Stats Tracking (Backend)
**Goal:** Start collecting data without changing user experience

**Tasks:**
1. Create `/api/lib/stats.js` with core functions
2. Add stats update logic to `/api/dailyroll.js`
3. Write unit tests for stats calculations
4. Deploy and verify data collection

**Testing:**
- Unit tests for pepega score calculation
- Unit tests for stats aggregation
- Manual verification: Make test rolls, check Redis

**Estimated effort:** 4-6 hours

### Phase 2: Personal Stats Command
**Goal:** Users can check `!stats`

**Tasks:**
1. Create `/api/stats/me.js` endpoint
2. Implement stats formatting for chat display
3. Add Fossabot command configuration
4. Test with real Fossabot integration

**Testing:**
- Test with users who have stats
- Test with users who have never rolled
- Verify character limit compliance (Twitch chat limit: 500 chars)

**Estimated effort:** 2-3 hours

### Phase 3: Leaderboard Commands
**Goal:** Users can check `!t500` and `!b500`

**Tasks:**
1. Create `/api/stats/leaderboard.js` endpoint
2. Create `/api/stats/pepega.js` endpoint
3. Implement rotation logic for leaderboard types
4. Add Fossabot command configurations
5. Test with real data

**Testing:**
- Test with empty leaderboards
- Test with < 5 users
- Test with full leaderboards
- Verify username display accuracy

**Estimated effort:** 3-4 hours

### Phase 4: Documentation & Polish
**Goal:** Complete feature documentation

**Tasks:**
1. Update README with new commands
2. Document data model changes
3. Add troubleshooting guide
4. Update .github/copilot-instructions.md

**Estimated effort:** 1-2 hours

## Data Model

See: [docs/architecture/data-model.md](../architecture/data-model.md)

## Fossabot Configuration

### Personal Stats
```
Command: !stats
Response: $(customapi https://your-project.vercel.app/api/stats/me)
Cooldown: 10 seconds per user
```

### Leaderboards
```
Command: !t500, !top500, !leaderboard
Response: $(customapi https://your-project.vercel.app/api/stats/leaderboard)
Cooldown: 30 seconds global
```

### Pepega Rankings
```
Command: !b500, !bottom500, !pepega
Response: $(customapi https://your-project.vercel.app/api/stats/pepega)
Cooldown: 30 seconds global
```

## Testing Strategy

### Unit Tests
- Stats calculation functions
- Pepega score formula
- Response formatting (character limits)
- Leaderboard ranking logic

### Integration Tests
- Full flow: roll → stats update → leaderboard update
- Stats retrieval for existing users
- Leaderboard queries with various data states

### Manual Testing Checklist
- [ ] User with no stats can roll and see stats afterward
- [ ] Stats display correctly in chat (< 500 chars)
- [ ] Leaderboards show accurate rankings
- [ ] Leaderboard rotation works (multiple calls show different types)
- [ ] Pepega rankings show lowest scores first
- [ ] Commands work with all aliases
- [ ] Channel gating works (only works in correct channel)
- [ ] Cooldowns prevent spam

## Rollout Plan

### Stage 1: Silent Deployment
- Deploy Phase 1 (stats tracking only)
- Monitor for 24-48 hours
- Verify data collection works
- Check Redis usage

### Stage 2: Soft Launch
- Deploy Phase 2 (`!stats` command)
- Announce to small test group
- Monitor command usage and errors
- Gather feedback

### Stage 3: Full Launch
- Deploy Phase 3 (leaderboards)
- Announce all commands to full audience
- Monitor Redis usage against free tier limits
- Watch for edge cases

## Risks & Mitigations

### Risk: Redis Free Tier Exceeded
**Likelihood:** Low  
**Impact:** High (service disruption)  
**Mitigation:**
- Monitor command usage in Upstash dashboard
- Set up alerts at 80% of daily limit
- Implement rate limiting if needed
- Leaderboard results can be cached (5-minute TTL)

### Risk: Character Limit Exceeded
**Likelihood:** Medium  
**Impact:** Medium (truncated messages)  
**Mitigation:**
- Hard limit response strings to 450 chars (50 char buffer)
- Test with long usernames
- Abbreviate if needed ("Highest IQ:" → "IQ:")

### Risk: Username Changes
**Likelihood:** Medium  
**Impact:** Low (wrong name displayed)  
**Mitigation:**
- Update username on every roll
- Accept that old leaderboard entries may show old usernames
- Not critical for engagement

### Risk: Manipulation/Cheating
**Likelihood:** Low  
**Impact:** Low (entertainment feature, not critical)  
**Mitigation:**
- Fossabot handles rate limiting
- API validates all requests
- Can manually remove suspicious entries if needed

## Success Metrics

- Command usage: Track invocations of each command
- Engagement: Are people using stats/leaderboards?
- Performance: Response time < 2 seconds
- Reliability: Error rate < 1%
- Cost: Stay within Upstash free tier

## Future Enhancements

Post-MVP ideas:
- Weekly/monthly leaderboard resets
- "Hall of Fame" for all-time records
- Special achievements/badges
- Hero-specific leaderboards
- Tier distribution statistics
- Streaks (X days in a row rolling)

## Open Questions

None - all clarified with product owner.

## Appendix

### Example Redis Commands

```bash
# Get user stats
HGETALL dailyroll:user:123456

# Get top 5 IQ
ZREVRANGE dailyroll:leaderboard:iq 0 4 WITHSCORES

# Get user's IQ rank
ZREVRANK dailyroll:leaderboard:iq 123456

# Get bottom 5 pepega
ZRANGE dailyroll:leaderboard:pepega 0 4 WITHSCORES

# Update leaderboards
ZADD dailyroll:leaderboard:iq 198 123456
ZADD dailyroll:leaderboard:height 110 123456
```

### Response Length Calculator

Max safe length: 450 characters

Example breakdown:
```
"TestUser: 23 rolls | Today: 142 IQ, 6'3", Reinhardt | Peak: 198 IQ, 9'2" | Rank: #3 IQ, #12 height, #47 pepega"
^                                                                                                                ^
= 124 characters (well within limit)
```

Worst case (long username + long hero name):
```
"VeryLongUsername123: 999 rolls | Today: 200 IQ, 9'11", Soldier: 76 | Peak: 200 IQ, 9'11" | Rank: #999 IQ, #999 height, #999 pepega"
= 138 characters (still safe)
```
