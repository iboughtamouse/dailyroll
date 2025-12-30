// Fossabot API integration utilities
// Shared validation and context retrieval

/**
 * Validate the Fossabot request and get context
 * @param {string} token - Fossabot custom API token from x-fossabot-customapitoken header
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
