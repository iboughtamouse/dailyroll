# Daily Roll API

A serverless API for Twitch chat that generates random "daily roll" stats with a 14-hour cooldown per user.

## Features

- **Random Stats**: Generates IQ (0-200), Height (0'0"-9'11"), and Overwatch 2 Hero
- **Cooldown System**: 14-hour cooldown per user with funny insult responses
- **Fossabot Integration**: Validates requests and extracts user information
- **Persistent Storage**: Uses Upstash Redis for reliable cooldown tracking
- **Multiple Formats**: Randomized response styles for variety

## Example Output

```
TestUser's Daily Roll: IQ 142 | Height 6'3" | Hero: Genji
🎲 TestUser rolled: 89 IQ, 5'8" tall, destined for Mercy
Daily Stats for TestUser: IQ 156 • 7'2" • Should play Reinhardt
```

## Deployment

### Prerequisites

1. **Vercel Account** - Sign up at https://vercel.com
2. **Upstash Redis** - Create a free database at https://upstash.com

### Setup Steps

#### 1. Fork/Clone This Repository

```bash
git clone https://github.com/yourusername/dailyroll-api.git
cd dailyroll-api
```

#### 2. Create Upstash Redis Database

1. Go to https://console.upstash.com
2. Create a new Redis database (free tier is fine)
3. Copy your credentials:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

#### 3. Deploy to Vercel

##### Option A: Using Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Add environment variables:
   - `UPSTASH_REDIS_REST_URL` = your Upstash URL
   - `UPSTASH_REDIS_REST_TOKEN` = your Upstash token
4. Click "Deploy"

##### Option B: Using Vercel CLI

```bash
npm install -g vercel
vercel
# Follow prompts and add environment variables when asked
```

#### 4. Configure Fossabot

1. Go to https://fossabot.com
2. Navigate to: Commands → Custom Commands → New Command
3. **Command**: `!dailyroll`
4. **Response**: `$(customapi https://your-project.vercel.app/api/dailyroll)`
5. Save and test in Twitch chat!

## Configuration

### Cooldown Duration

Edit `COOLDOWN_MS` in `api/dailyroll.js`:

```javascript
const COOLDOWN_MS = 14 * 60 * 60 * 1000; // 14 hours
```

### Add More Insults

Edit the `INSULTS` array in `api/dailyroll.js`:

```javascript
const INSULTS = [
  "nice double roll JACKASS",
  "your custom insult here",
  // ... more insults
];
```

### Update Hero Roster

Edit the `HEROES` array in `api/dailyroll.js` to add/remove heroes.

## Environment Variables

Required environment variables in Vercel:

| Variable | Description | Example |
|----------|-------------|---------|
| `UPSTASH_REDIS_REST_URL` | Your Upstash Redis REST URL | `https://xyz.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Your Upstash Redis REST token | `AXXXxxxXXX...` |

## How It Works

1. User types `!dailyroll` in Twitch chat
2. Fossabot calls your API endpoint with validation token
3. API validates request with Fossabot
4. API checks Redis for user's last roll timestamp
5. If within cooldown → return insult with time remaining
6. If cooldown expired → generate new roll and store in Redis
7. Return formatted response to chat

## Tech Stack

- **Vercel** - Serverless hosting
- **Upstash Redis** - Persistent key-value storage
- **Fossabot** - Twitch bot integration
- **Node.js** - Runtime

## Development

### Local Testing

```bash
npm install
vercel env pull .env.local
vercel dev
```

### Testing the API

You cannot test this API directly in a browser because it requires Fossabot headers. You must test through a Fossabot command.

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

### Connection errors
- Ensure your Upstash Redis database is in the free tier and not paused
- Verify your REST credentials are correct

## License

MIT

## Contributing

Pull requests welcome! Feel free to add features, fix bugs, or improve documentation.

## Possible Enhancements

- [ ] Stream-based cooldown resets (reset when stream goes live)
- [ ] Leaderboards (highest IQ, tallest height, etc.)
- [ ] Special weekend bonuses
- [ ] Per-hero custom response messages
- [ ] Stats tracking and analytics
- [ ] Role-based special rolls (subs, mods)
