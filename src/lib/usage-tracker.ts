/**
 * Client-side and server-side usage tracking helper
 *
 * Tracks Twitter API usage for rate limit monitoring
 */

import { logger } from './logger';

export async function trackTwitterUsage(type: 'post' | 'read'): Promise<void> {
  try {
    // Only track in browser or server with fetch available
    if (typeof fetch === 'undefined') {
      logger.warn('fetch not available, skipping usage tracking');
      return;
    }

    await fetch('/api/twitter/usage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type }),
    });

    logger.debug({ type }, 'Tracked Twitter API usage');
  } catch (error) {
    // Don't throw - usage tracking should never break the main flow
    logger.error({ error, type }, 'Failed to track Twitter API usage');
  }
}

/**
 * Track a post (tweet, reply, retweet, etc.)
 */
export function trackPost(): Promise<void> {
  return trackTwitterUsage('post');
}

/**
 * Track a read operation (search, fetch tweets, etc.)
 */
export function trackRead(): Promise<void> {
  return trackTwitterUsage('read');
}
