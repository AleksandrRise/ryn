//! Rate limiter for API calls to prevent excessive costs
//!
//! This module implements a token bucket rate limiter to control
//! the frequency of API calls to Claude, preventing runaway costs.

use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

/// Rate limiter configuration
#[derive(Debug, Clone)]
pub struct RateLimiterConfig {
    /// Maximum requests per minute
    pub max_requests_per_minute: u32,
    /// Maximum requests per hour
    pub max_requests_per_hour: u32,
    /// Maximum requests per day
    pub max_requests_per_day: u32,
    /// Whether to enable rate limiting (can be disabled for testing)
    pub enabled: bool,
}

impl Default for RateLimiterConfig {
    fn default() -> Self {
        Self {
            max_requests_per_minute: 10,  // 10 fixes per minute max
            max_requests_per_hour: 100,   // 100 fixes per hour max
            max_requests_per_day: 500,    // 500 fixes per day max
            enabled: true,
        }
    }
}

/// Token bucket for rate limiting
struct TokenBucket {
    /// Maximum tokens in bucket
    capacity: u32,
    /// Current tokens available
    tokens: f64,
    /// Last time tokens were refilled
    last_refill: Instant,
    /// Refill rate (tokens per second)
    refill_rate: f64,
}

impl TokenBucket {
    fn new(capacity: u32, refill_rate: f64) -> Self {
        Self {
            capacity,
            tokens: capacity as f64,
            last_refill: Instant::now(),
            refill_rate,
        }
    }

    /// Try to consume one token, returns true if successful
    fn try_consume(&mut self) -> bool {
        self.refill();

        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }

    /// Get time until next token is available
    fn time_until_available(&mut self) -> Option<Duration> {
        self.refill();

        if self.tokens >= 1.0 {
            None
        } else {
            let tokens_needed = 1.0 - self.tokens;
            let seconds_needed = tokens_needed / self.refill_rate;
            Some(Duration::from_secs_f64(seconds_needed))
        }
    }

    /// Refill tokens based on elapsed time
    fn refill(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();

        let tokens_to_add = elapsed * self.refill_rate;
        self.tokens = (self.tokens + tokens_to_add).min(self.capacity as f64);
        self.last_refill = now;
    }
}

/// Rate limiter using multiple token buckets for different time windows
pub struct RateLimiter {
    minute_bucket: Arc<Mutex<TokenBucket>>,
    hour_bucket: Arc<Mutex<TokenBucket>>,
    day_bucket: Arc<Mutex<TokenBucket>>,
    config: RateLimiterConfig,
    /// Track total API calls for monitoring
    total_calls: Arc<Mutex<u64>>,
}

impl RateLimiter {
    /// Create new rate limiter with default config
    pub fn new() -> Self {
        Self::with_config(RateLimiterConfig::default())
    }

    /// Create new rate limiter with custom config
    pub fn with_config(config: RateLimiterConfig) -> Self {
        // Calculate refill rates (tokens per second)
        let minute_rate = config.max_requests_per_minute as f64 / 60.0;
        let hour_rate = config.max_requests_per_hour as f64 / 3600.0;
        let day_rate = config.max_requests_per_day as f64 / 86400.0;

        Self {
            minute_bucket: Arc::new(Mutex::new(TokenBucket::new(
                config.max_requests_per_minute,
                minute_rate,
            ))),
            hour_bucket: Arc::new(Mutex::new(TokenBucket::new(
                config.max_requests_per_hour,
                hour_rate,
            ))),
            day_bucket: Arc::new(Mutex::new(TokenBucket::new(
                config.max_requests_per_day,
                day_rate,
            ))),
            config,
            total_calls: Arc::new(Mutex::new(0)),
        }
    }

    /// Check if request is allowed and consume token if so
    pub async fn check_rate_limit(&self) -> Result<(), RateLimitError> {
        if !self.config.enabled {
            return Ok(());
        }

        // Check all buckets
        let mut minute_bucket = self.minute_bucket.lock().await;
        let mut hour_bucket = self.hour_bucket.lock().await;
        let mut day_bucket = self.day_bucket.lock().await;

        // Find which bucket would block the longest
        let minute_wait = minute_bucket.time_until_available();
        let hour_wait = hour_bucket.time_until_available();
        let day_wait = day_bucket.time_until_available();

        // Determine maximum wait time
        let max_wait = [minute_wait, hour_wait, day_wait]
            .into_iter()
            .flatten()
            .max();

        if let Some(wait_duration) = max_wait {
            // Rate limit exceeded
            let wait_seconds = wait_duration.as_secs();
            let limit_type = if minute_wait.is_some() {
                "minute"
            } else if hour_wait.is_some() {
                "hour"
            } else {
                "day"
            };

            return Err(RateLimitError::RateLimitExceeded {
                wait_seconds,
                limit_type: limit_type.to_string(),
            });
        }

        // Consume tokens from all buckets
        if !minute_bucket.try_consume() || !hour_bucket.try_consume() || !day_bucket.try_consume() {
            // This shouldn't happen if time_until_available worked correctly
            return Err(RateLimitError::RateLimitExceeded {
                wait_seconds: 1,
                limit_type: "unknown".to_string(),
            });
        }

        // Track total calls
        let mut total = self.total_calls.lock().await;
        *total += 1;

        Ok(())
    }

    /// Get current statistics
    pub async fn get_stats(&self) -> RateLimiterStats {
        let minute_bucket = self.minute_bucket.lock().await;
        let hour_bucket = self.hour_bucket.lock().await;
        let day_bucket = self.day_bucket.lock().await;
        let total = self.total_calls.lock().await;

        RateLimiterStats {
            minute_tokens_available: minute_bucket.tokens as u32,
            hour_tokens_available: hour_bucket.tokens as u32,
            day_tokens_available: day_bucket.tokens as u32,
            total_calls: *total,
        }
    }

    /// Reset rate limiter (useful for testing)
    pub async fn reset(&self) {
        let mut minute_bucket = self.minute_bucket.lock().await;
        let mut hour_bucket = self.hour_bucket.lock().await;
        let mut day_bucket = self.day_bucket.lock().await;
        let mut total = self.total_calls.lock().await;

        minute_bucket.tokens = minute_bucket.capacity as f64;
        hour_bucket.tokens = hour_bucket.capacity as f64;
        day_bucket.tokens = day_bucket.capacity as f64;
        *total = 0;
    }
}

/// Rate limiter statistics
#[derive(Debug, Clone)]
pub struct RateLimiterStats {
    pub minute_tokens_available: u32,
    pub hour_tokens_available: u32,
    pub day_tokens_available: u32,
    pub total_calls: u64,
}

/// Rate limit errors
#[derive(Debug, thiserror::Error)]
pub enum RateLimitError {
    #[error("Rate limit exceeded for {limit_type}. Please wait {wait_seconds} seconds before retrying.")]
    RateLimitExceeded {
        wait_seconds: u64,
        limit_type: String,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_rate_limiter_allows_initial_requests() {
        let config = RateLimiterConfig {
            max_requests_per_minute: 5,
            max_requests_per_hour: 10,
            max_requests_per_day: 20,
            enabled: true,
        };

        let limiter = RateLimiter::with_config(config);

        // Should allow first 5 requests
        for _ in 0..5 {
            assert!(limiter.check_rate_limit().await.is_ok());
        }

        // 6th request should be rate limited
        assert!(limiter.check_rate_limit().await.is_err());
    }

    #[tokio::test]
    async fn test_rate_limiter_disabled() {
        let config = RateLimiterConfig {
            max_requests_per_minute: 1,
            max_requests_per_hour: 1,
            max_requests_per_day: 1,
            enabled: false, // Disabled
        };

        let limiter = RateLimiter::with_config(config);

        // Should allow unlimited requests when disabled
        for _ in 0..10 {
            assert!(limiter.check_rate_limit().await.is_ok());
        }
    }

    #[tokio::test]
    async fn test_rate_limiter_stats() {
        let config = RateLimiterConfig {
            max_requests_per_minute: 5,
            max_requests_per_hour: 10,
            max_requests_per_day: 20,
            enabled: true,
        };

        let limiter = RateLimiter::with_config(config);

        // Make 3 requests
        for _ in 0..3 {
            let _ = limiter.check_rate_limit().await;
        }

        let stats = limiter.get_stats().await;
        assert_eq!(stats.total_calls, 3);
        assert!(stats.minute_tokens_available <= 2);
    }

    #[tokio::test]
    async fn test_token_bucket_refill() {
        let mut bucket = TokenBucket::new(10, 10.0); // 10 tokens per second

        // Consume all tokens
        bucket.tokens = 0.0;

        // Wait a bit for refill (simulated by setting last_refill in past)
        bucket.last_refill = Instant::now() - Duration::from_millis(100); // 0.1 seconds ago

        // Should have refilled ~1 token
        bucket.refill();
        assert!(bucket.tokens >= 0.9 && bucket.tokens <= 1.1);
    }
}