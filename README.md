# Daily Roll API

A serverless API for Twitch chat that generates random "daily roll" stats with smart cooldowns. Originally made for twitch.tv/august

## Features

- **Random Stats**: Generates IQ (0-200), Height (0'0"-9'11"), and Overwatch 2 Hero
- **Smart Cooldown System**: 
  - When stream is **LIVE**: One roll per stream session
  - When stream is **OFFLINE**: 24-hour cooldown
  - Spam protection with insults for repeated attempts
- **Stats Tracking**: Automatically tracks each user's roll history
  - Total rolls, current stats, peak IQ/height
  - Tier distribution (hamster, unga, normal, bigbrain, overqualified)
  - "Pepega score" - composite luck rating (0-1 scale)
- **Leaderboards**: Compare with other users
  - Top 5 by IQ, height, or total rolls
  - Bottom 5 by pepega score (worst luck)
  - Personal ranks visible in stats
- **Twitch API Integration**: Accurately detects stream start time for per-stream cooldowns
- **Fossabot Integration**: Validates requests and extracts user information
- **Persistent Storage**: Uses Upstash Redis for reliable cooldown and stats tracking
- **Multiple Formats**: Randomized response styles for variety

## Example Output

### Daily Roll (`!roll`)

```
TestUser rolled 45 IQ and 2'4" height - literal hamster brain. Play Wrecking Ball.
142 IQ and 6'3" for TestUser. Big weapon, simple plan. Reinhardt awaits. HONOR!! JUSTICE!! CHUNGUS FUCKING CHUNGUS!
TestUser: 156 IQ, 7'2" tall - you've got a brain, use it. Play Widowmaker.
```

### Personal Stats (`!stats`)

```
august: 42 rolls | Today: 142 IQ, 6'3", Reinhardt | Peak: 189 IQ, 8'5" | Rank: #10 IQ, #15 height, #200 pepega
newbie: No rolls yet! Type !roll to get started.
```

### Leaderboards (`!t500`, `!b500`)

```
🧠 Highest IQ This Stream: 🥇 BrainGod (198) | 🥈 SmartGuy (187) | 🥉 NotBad (156) | #4 Average (142) | #5 Normal (130)
📏 Tallest This Stream: 🥇 TallBoi (9'11") | 🥈 BigGuy (8'5") | 🥉 MediumBoi (6'3") | #4 ShortKing (5'6") | #5 Smol (4'2")
💩 Lowest IQ This Stream: 🥇 Unlucky1 (15) | 🥈 Unlucky2 (22) | 🥉 BadLuck (28) | #4 Pepega (35) | #5 Unfortunate (42)
```

**Note:** Leaderboards reset each stream and show only the current broadcast's rankings.

## Deployment

### Prerequisites

1. **Vercel Account** - Sign up at https://vercel.com
2. **Upstash Redis** - Create a free database at https://upstash.com
3. **Twitch Developer App** - Create at https://dev.twitch.tv/console/apps

### Setup Steps

#### 1. Fork/Clone This Repository

```bash
git clone https://github.com/yourusername/dailyroll.git
cd dailyroll
```

#### 2. Create Upstash Redis Database

1. Go to https://console.upstash.com
2. Create a new Redis database (free tier is fine)
3. Copy your credentials:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

#### 3. Create Twitch Developer App

1. Go to https://dev.twitch.tv/console/apps
2. Click "Register Your Application"
3. Fill in:
   - **Name**: `DailyRoll Bot` (or any name you prefer)
   - **OAuth Redirect URLs**: `http://localhost`
   - **Category**: `Chat Bot`
4. Click "Create"
5. Click "Manage" on your new application
6. Copy your credentials:
   - `TWITCH_CLIENT_ID` (visible)
   - `TWITCH_CLIENT_SECRET` (click "New Secret" to generate)

#### 4. Deploy to Vercel

##### Option A: Using Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Add environment variables:
   - `UPSTASH_REDIS_REST_URL` = your Upstash URL
   - `UPSTASH_REDIS_REST_TOKEN` = your Upstash token
   - `TWITCH_CLIENT_ID` = your Twitch Client ID
   - `TWITCH_CLIENT_SECRET` = your Twitch Client Secret
   - `STREAMER_NAME` = your Twitch display name (uppercase, e.g., `AUGUST`)
4. Click "Deploy"

##### Option B: Using Vercel CLI

```bash
npm install -g vercel
vercel
# Follow prompts and add environment variables when asked
```

#### 5. Configure Fossabot Commands

1. Go to https://fossabot.com
2. Navigate to: Commands → Custom Commands → New Command

**Daily Roll Command:**
- **Command**: `!roll`
- **Response**: `$(customapi https://your-project.vercel.app/api/dailyroll)`
- **Cooldown**: None (API handles cooldowns)

**Personal Stats Command:**
- **Command**: `!stats`
- **Response**: `$(customapi https://your-project.vercel.app/api/stats/me)`
- **Cooldown**: 10 seconds per user (recommended)

**Leaderboard Commands:**
- **Command**: `!t500` (or `!top500`, `!leaderboard`)
- **Response**: `$(customapi https://your-project.vercel.app/api/stats/leaderboard?type=$(query))`
- **Cooldown**: 30 seconds globally (recommended)
- **Usage**: `!t500` (random), `!t500 iq`, `!t500 height`

**Bottom Leaderboard Commands:**
- **Command**: `!b500` (or `!bottom500`, `!pepega`)
- **Response**: `$(customapi https://your-project.vercel.app/api/stats/pepega)`
- **Cooldown**: 30 seconds globally (recommended)

Save and test in Twitch chat!

## Configuration

### Cooldown Behavior

The API uses different cooldown strategies depending on stream status:

- **When LIVE**: Users can roll a configurable number of times per stream (default: 1). The cooldown resets when a new stream starts.
- **When OFFLINE**: Users can roll once per 24 hours.

This behavior is handled automatically by querying the Twitch API for stream status.

### Modify Roll Limits

To allow multiple rolls per stream (useful for testing), set the `MAX_ROLLS_PER_STREAM` environment variable:

```bash
# In Vercel dashboard or .env file
MAX_ROLLS_PER_STREAM=5  # Allow 5 rolls per stream (default: 1)
```

To change the offline cooldown duration, edit `api/dailyroll.js`:

```javascript
const OFFLINE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
```

### Add More Insults

Edit the `INSULTS` array in `api/lib/game.js`:

```javascript
export const INSULTS = [
  "nice double roll JACKASS",
  "your custom insult here",
  // ... more insults
];
```

### Update Hero Roster

Edit `api/data/heroes.json` to add/remove heroes. The roster is organized by tiers:
- **Tier 1 (hamster)**: Simple, instinct-based heroes
- **Tier 2 (unga)**: Low skill floor, hit things hard
- **Tier 3 (normal)**: Average skill, normal gameplay
- **Tier 4 (bigbrain)**: High skill expression, tactical
- **Tier 5 (overqualified)**: Highest skill ceiling

Simply add hero names to the `heroes` array of the appropriate tier and deploy.

### Adjust Cache Duration

Stream start times are cached for 5 minutes to reduce Twitch API calls. To adjust this, edit `api/lib/twitch.js`:

```javascript
const FIVE_MINUTES_SECONDS = 5 * 60; // Change this value
```

## Environment Variables

Required environment variables in Vercel:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `UPSTASH_REDIS_REST_URL` | Your Upstash Redis REST URL | *(required)* | `https://xyz.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Your Upstash Redis REST token | *(required)* | `AXXXxxxXXX...` |
| `TWITCH_CLIENT_ID` | Your Twitch application Client ID | *(required)* | `abc123xyz...` |
| `TWITCH_CLIENT_SECRET` | Your Twitch application Client Secret | *(required)* | `secret123...` |
| `STREAMER_NAME` | Your Twitch display name (uppercase) | *(required)* | `AUGUST` |
| `MAX_ROLLS_PER_STREAM` | Max rolls allowed per stream (for testing) | `1` | `5` |

## How It Works

### Daily Roll (`!roll`)

1. User types `!roll` in Twitch chat
2. Fossabot calls your API endpoint with validation token
3. API validates request with Fossabot to get user and channel info
4. If stream is live, API calls Twitch API to get actual stream start time (cached for 5 minutes)
5. API checks Redis for user's last roll timestamp
6. **If stream is LIVE**:
   - If user already rolled during this stream → return insult
   - If user's last roll was before stream started → generate new roll
7. **If stream is OFFLINE**:
   - If within 24 hours of last roll → return insult
   - If 24+ hours since last roll → generate new roll
8. Spam protection: If user tries 2+ times during cooldown, timeout for 60 seconds
9. Generate stats and update user's Redis hash with roll data
10. Update 4 leaderboards (IQ, height, rolls, pepega score)
11. Return formatted response to chat

### Personal Stats (`!stats`)

1. User types `!stats` in Twitch chat
2. API retrieves user's stats from Redis hash
3. Calculates user's rank across all leaderboards
4. Returns formatted stats: total rolls, current stats, peak stats, ranks

### Leaderboards (`!t500`, `!b500`)

1. User types leaderboard command in Twitch chat
2. **!t500**: Shows top 5 for current stream
   - Random selection (no args): picks IQ or height
   - Specific: `!t500 iq` or `!t500 height`
3. **!b500**: Shows bottom 5 IQ scores from current stream
4. Leaderboards reset each stream (based on Twitch stream start time)
5. Returns formatted top/bottom 5 with medals (🥇🥈🥉) and scores

## Tech Stack

- **Vercel** - Serverless hosting
- **Upstash Redis** - Persistent key-value storage
- **Twitch API** - Stream status and metadata
- **Fossabot** - Twitch bot integration
- **Node.js** - Runtime

## Development

### Setup

```bash
npm install
cp .env.example .env
# Edit .env with your credentials
```

### Local Testing

```bash
vercel env pull .env.local  # Pull from Vercel (if already deployed)
vercel dev
```

### Running Tests

The project includes a test suite using Vitest:

```bash
# Run tests in watch mode (reruns on file changes)
npm test

# Run tests once (for CI/scripts)
npm run test:run
```

Tests cover:
- IQ and height generation
- Tier assignment logic
- Hero selection
- Response formatting
- Insult randomization
- Stats tracking and pepega score calculation
- Leaderboard formatting
- Character limit compliance (< 450 chars for Twitch safety)

### Testing the API Endpoint

You cannot test this API directly in a browser because it requires Fossabot headers. You must test through a Fossabot command in Twitch chat.

## Troubleshooting

### "Missing Fossabot token"
- Ensure you're using `$(customapi URL)` syntax in Fossabot
- Do not test the URL directly in a browser

### "Invalid or expired token"
- Fossabot tokens are single-use
- This shouldn't happen during normal usage

### Cooldown not working
- Verify environment variables are set correctly in Vercel
- Check Upstash Redis dashboard to confirm database is active
- For live streams: Verify Twitch Client ID and Secret are correct
- Check Vercel logs for any Twitch API errors

### Connection errors
- Ensure your Upstash Redis database is in the free tier and not paused
- Verify your REST credentials are correct

### "Error fetching stream start time"
- Verify your Twitch Client ID and Secret are valid
- Check that your Twitch app hasn't been deleted or suspended
- This error won't break the bot - it will fall back to 24-hour cooldown

## License

MIT

## Contributing

No thank you! :) I don't want it. If you want to add shit to this, fork it, clone it, rename it and pretend its all yours and take the credit, I straight up do not care. I don't give a shit about a twitch command. I'm not maintaining this.

But if you want it just clone it or fork it. Idk.

## Deployment Notes

### First-Time Deployment

For a fresh deployment:

1. Fork/clone this repository
2. Set up Upstash Redis and Twitch API credentials
3. Deploy to Vercel with environment variables
4. Configure Fossabot commands
5. Test in Twitch chat

The first user roll will initialize the stats system automatically. No database migration needed.

### Redis Schema

The API uses the following Redis structure:
- **User data**: `dailyroll:user:{userId}` (hash with 24 fields including stats and cooldown tracking)
- **Username lookup**: `dailyroll:username:{userId}` (string)
- **Leaderboards**: `dailyroll:leaderboard:stream_{timestamp}:{iq|height|iq_low}` (sorted sets, per-stream)
- **Stream cache**: `stream:{providerId}:start_time` (string, 5min TTL)
- **Twitch token**: `twitch:app_token` (string, 50d TTL)

**Note:** Leaderboards are stream-specific and reset each broadcast. Old stream leaderboards accumulate in Redis and may need periodic cleanup.

See [docs/architecture/data-model.md](docs/architecture/data-model.md) for detailed schema documentation.

## Possible Enhancements

- [x] Leaderboards (highest IQ, tallest height, etc.)
- [x] Stats tracking and analytics
- [ ] Special weekend bonuses
- [ ] Per-hero custom response messages
- [ ] Role-based special rolls (subs, mods)
- [ ] Multi-language support
- [ ] Historical roll graphs/charts
- [ ] Monthly/seasonal stat resets
