/**
 * Sync configuration and constants
 */
const SYNC_CONFIG = {
    TIMEOUTS: {
        DEFAULT: 30000,
        INITIAL_SYNC: 60000,
        LIVE_SYNC: 60000,
        PERIODIC_SYNC: 120000,
    },
    BATCH_SIZES: {
        INITIAL_SYNC: 1000,
        LIVE_SYNC: 250,
        PERIODIC_SYNC: 100,
    },
    INTERVALS: {
        PERIODIC_SYNC: 30 * 60 * 1000, // 30 minutes
        HEARTBEAT: 10000,
    },
    DDE: {
        TARGET_COUNT: 10,
        MAX_RETRIES: 3,
        LOW_THRESHOLD: 3,
    },
};
