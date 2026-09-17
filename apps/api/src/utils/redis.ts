import IORedis from 'ioredis';
import { logger } from './logger.js';

let redis: IORedis | null = null;

export function getRedis(): IORedis {
  if (!redis) {
    redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        if (times > 10) {
          logger.error('Redis connection failed after 10 retries');
          return null;
        }
        return Math.min(times * 200, 5000);
      },
    });

    redis.on('connect', () => logger.info('Redis connected'));
    redis.on('error', (err) => logger.error('Redis error', { error: err.message }));
  }
  return redis;
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
