// Orchestra Desktop — Tunnel Reconnect Logic
//
// Exponential backoff with jitter, matching the Go plugin-tunnel implementation.

use crate::tunnel::types::ReconnectConfig;
use rand::Rng;
use std::time::Duration;

/// Calculate the backoff delay for a given attempt number (1-based).
///
/// Formula: delay = initial_delay * multiplier^(attempt-1), capped at max_delay,
/// then jitter applied as: delay +/- (delay * jitter * random).
pub fn calculate_delay(config: &ReconnectConfig, attempt: u32) -> Duration {
    let base = config.initial_delay.as_secs_f64() * config.multiplier.powi(attempt as i32 - 1);
    let capped = base.min(config.max_delay.as_secs_f64());

    let delay = if config.jitter > 0.0 {
        let jitter_range = capped * config.jitter;
        let mut rng = rand::rng();
        let offset = rng.random_range(-jitter_range..=jitter_range);
        (capped + offset).max(0.0)
    } else {
        capped
    };

    Duration::from_secs_f64(delay)
}

/// Check whether we should give up reconnecting based on config and attempt count.
pub fn should_give_up(config: &ReconnectConfig, attempt: u32) -> bool {
    config.max_attempts > 0 && attempt > config.max_attempts
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config_delays() {
        let config = ReconnectConfig {
            jitter: 0.0, // disable jitter for deterministic test
            ..Default::default()
        };

        // Attempt 1: 1s
        let d1 = calculate_delay(&config, 1);
        assert!((d1.as_secs_f64() - 1.0).abs() < 0.001);

        // Attempt 2: 2s
        let d2 = calculate_delay(&config, 2);
        assert!((d2.as_secs_f64() - 2.0).abs() < 0.001);

        // Attempt 3: 4s
        let d3 = calculate_delay(&config, 3);
        assert!((d3.as_secs_f64() - 4.0).abs() < 0.001);

        // Attempt 7: 64s -> capped at 60s
        let d7 = calculate_delay(&config, 7);
        assert!((d7.as_secs_f64() - 60.0).abs() < 0.001);
    }

    #[test]
    fn test_jitter_stays_in_range() {
        let config = ReconnectConfig::default(); // jitter = 0.3
        for attempt in 1..=10 {
            let delay = calculate_delay(&config, attempt);
            let base = (1.0_f64 * 2.0_f64.powi(attempt as i32 - 1)).min(60.0);
            let min_expected = base * (1.0 - config.jitter);
            let max_expected = base * (1.0 + config.jitter);
            assert!(
                delay.as_secs_f64() >= min_expected * 0.99
                    && delay.as_secs_f64() <= max_expected * 1.01,
                "attempt {} delay {} not in [{}, {}]",
                attempt,
                delay.as_secs_f64(),
                min_expected,
                max_expected
            );
        }
    }

    #[test]
    fn test_should_give_up() {
        let unlimited = ReconnectConfig::default();
        assert!(!should_give_up(&unlimited, 999));

        let limited = ReconnectConfig {
            max_attempts: 5,
            ..Default::default()
        };
        assert!(!should_give_up(&limited, 5));
        assert!(should_give_up(&limited, 6));
    }
}
