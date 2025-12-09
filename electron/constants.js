/**
 * Application-wide constants for the main process
 */

// Timer intervals
export const SCREENSHOT_INTERVAL_MS = 30_000; // 30 seconds
export const AUTO_ANALYSIS_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Window dimensions
export const WIDGET_CIRCLE_SIZE = 160;
export const PANEL_WIDTH = 440;
export const PANEL_HEIGHT = 380;

// Screenshot settings
export const SCREENSHOT_JPEG_QUALITY = 0.85;
export const SCREENSHOT_MAX_WIDTH = 1440;
export const DEFAULT_RECENT_SCREENSHOTS_LIMIT = 10;
export const SHA_HASH_LENGTH = 8;
export const SESSION_CLEANUP_BUFFER_MS = 5000; // 5 seconds

// Window settings
export const WINDOW_MARGIN = 20; // Margin from screen edges in pixels
export const MAX_PENDING_CHANGES = 5; // Maximum queued view changes

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
