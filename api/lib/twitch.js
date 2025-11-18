// Twitch API integration for stream data
// Handles app access token management and stream info fetching

/**
 * Get or refresh Twitch app access token
 * Token is cached in Redis with 50-day expiration (tokens last 60 days)
 */
export async function getTwitchAppToken(redis) {
  const cachedToken = await redis.get('twitch:app_token');
  
  if (cachedToken) {
    console.log('Using cached Twitch app token');
    return cachedToken;
  }
  
  console.log('Fetching new Twitch app token');
  
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET environment variables');
  }
  
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Twitch app token: ${error}`);
  }
  
  const data = await response.json();
  
  // Cache token for 50 days (tokens last 60 days, we refresh early)
  const FIFTY_DAYS_SECONDS = 50 * 24 * 60 * 60;
  await redis.set('twitch:app_token', data.access_token, {
    ex: FIFTY_DAYS_SECONDS
  });
  
  return data.access_token;
}

/**
 * Get stream start time from Twitch API
 * Returns the started_at timestamp or null if stream is not live
 */
export async function getStreamStartTime(redis, providerId) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  
  if (!clientId) {
    throw new Error('Missing TWITCH_CLIENT_ID environment variable');
  }
  
  // Check cache first (5-minute TTL)
  const cacheKey = `stream:${providerId}:start_time`;
  const cachedStartTime = await redis.get(cacheKey);
  
  if (cachedStartTime) {
    console.log('Using cached stream start time:', cachedStartTime);
    return cachedStartTime;
  }
  
  console.log('Fetching stream start time from Twitch API');
  
  // Get app access token
  const token = await getTwitchAppToken(redis);
  
  // Fetch stream data
  const response = await fetch(`https://api.twitch.tv/helix/streams?user_id=${providerId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Client-Id': clientId,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch stream data: ${error}`);
  }
  
  const data = await response.json();
  
  // If stream is live, data.data will have one element with started_at
  if (data.data && data.data.length > 0) {
    const startedAt = data.data[0].started_at;
    
    // Cache for 5 minutes
    const FIVE_MINUTES_SECONDS = 5 * 60;
    await redis.set(cacheKey, startedAt, {
      ex: FIVE_MINUTES_SECONDS
    });
    
    console.log('Stream start time:', startedAt);
    return startedAt;
  }
  
  // Stream not live
  console.log('Stream is not live');
  return null;
}
