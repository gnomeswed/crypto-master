// Simple in-memory rate limiter
class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  constructor(private maxRequests: number, private windowMs: number) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const timestamps = this.requests.get(key)!;
    // Remove old timestamps
    const validTimestamps = timestamps.filter(ts => ts > windowStart);
    this.requests.set(key, validTimestamps);

    if (validTimestamps.length < this.maxRequests) {
      validTimestamps.push(now);
      return true;
    }

    return false;
  }
}

// Global rate limiter: 10 requests per second per key
const globalLimiter = new RateLimiter(10, 1000);

export function checkRateLimit(key: string): boolean {
  return globalLimiter.isAllowed(key);
}