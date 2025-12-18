# Daily Roll API

A serverless API for Twitch chat that generates random "daily roll" stats with smart cooldowns. Originally made for twitch.tv/august

## Features

- **Random Stats**: Generates IQ (0-200), Height (0'0"-9'11"), and Overwatch 2 Hero
- **Smart Cooldown System**: 
  - When stream is **LIVE**: One roll per stream session
  - When stream is **OFFLINE**: 24-hour cooldown
  - Spam protection with insults for repeated attempts
- **Twitch API Integration**: Accurately detects stream start time for per-stream cooldowns
- **Fossabot Integration**: Validates requests and extracts user information
- **Persistent Storage**: Uses Upstash Redis for reliable cooldown tracking
- **Multiple Formats**: Randomized response styles for variety

## Example Output

```
TestUser rolled 45 IQ and 2'4" height - literal hamster brain. Play Wrecking Ball.
142 IQ and 6'3" for TestUser. Big weapon, simple plan. Reinhardt awaits. HONOR!! JUSTICE!! CHUNGUS FUCKING CHUNGUS!
TestUser: 156 IQ, 7'2" tall - you've got a brain, use it. Play Widowmaker.
```

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

#### 5. Configure Fossabot

1. Go to https://fossabot.com
2. Navigate to: Commands → Custom Commands → New Command
3. **Command**: `!dailyroll`
4. **Response**: `$(customapi https://your-project.vercel.app/api/dailyroll)`
5. Save and test in Twitch chat!

## Configuration

### Cooldown Behavior

The API uses different cooldown strategies depending on stream status:

- **When LIVE**: Users can roll once per stream. The cooldown resets when a new stream starts.
- **When OFFLINE**: Users can roll once per 24 hours.

This behavior is handled automatically by querying the Twitch API for stream status.

### Modify Cooldown Duration

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

| Variable | Description | Example |
|----------|-------------|---------|
| `UPSTASH_REDIS_REST_URL` | Your Upstash Redis REST URL | `https://xyz.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Your Upstash Redis REST token | `AXXXxxxXXX...` |
| `TWITCH_CLIENT_ID` | Your Twitch application Client ID | `abc123xyz...` |
| `TWITCH_CLIENT_SECRET` | Your Twitch application Client Secret | `secret123...` |
| `STREAMER_NAME` | Your Twitch display name (uppercase) | `AUGUST` |

## How It Works

1. User types `!dailyroll` in Twitch chat
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
9. Return formatted response to chat

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

Pull requests welcome! Feel free to add features, fix bugs, or improve documentation.

## Possible Enhancements

- [ ] Leaderboards (highest IQ, tallest height, etc.)
- [ ] Special weekend bonuses
- [ ] Per-hero custom response messages
- [ ] Stats tracking and analytics
- [ ] Role-based special rolls (subs, mods)
- [ ] Multi-language support
