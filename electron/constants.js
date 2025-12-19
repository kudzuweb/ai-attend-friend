/**
 * Application-wide constants for the main process
 */

// Timer intervals
export const SCREENSHOT_INTERVAL_MS = 30_000; // 30 seconds
export const AUTO_ANALYSIS_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Demo mode intervals (fast loop for testing)
export const DEMO_SCREENSHOT_INTERVAL_MS = 3_000; // 3 seconds
export const DEMO_ANALYSIS_INTERVAL_MS = 15_000; // 15 seconds
export const DEMO_SCREENSHOTS_LIMIT = 5;

// Window dimensions
export const MAIN_WINDOW_MIN_WIDTH = 800;
export const MAIN_WINDOW_MIN_HEIGHT = 600;
export const MAIN_WINDOW_DEFAULT_WIDTH = 900;
export const MAIN_WINDOW_DEFAULT_HEIGHT = 600;

// Session widget dimensions
export const SESSION_WIDGET_WIDTH = 300;
export const SESSION_WIDGET_HEIGHT = 420;

// Screenshot settings
export const SCREENSHOT_JPEG_QUALITY = 0.85;
export const SCREENSHOT_MAX_WIDTH = 1440;
export const DEFAULT_RECENT_SCREENSHOTS_LIMIT = 10;
export const SHA_HASH_LENGTH = 8;
export const SESSION_CLEANUP_BUFFER_MS = 5000; // 5 seconds

// Window settings
export const WINDOW_MARGIN = 20; // Margin from screen edges in pixels

// Deletion retention periods (in milliseconds)
export const DELETED_TASK_RETENTION = {
  '1day': 24 * 60 * 60 * 1000,
  '7days': 7 * 24 * 60 * 60 * 1000,
  '30days': 30 * 24 * 60 * 60 * 1000,
};

/**
 * Parse retention period string to milliseconds
 * @param {string} period - '1day', '7days', or '30days'
 * @returns {number} retention period in milliseconds
 */
export function parseRetentionPeriod(period) {
  return DELETED_TASK_RETENTION[period] || DELETED_TASK_RETENTION['7days'];
}
