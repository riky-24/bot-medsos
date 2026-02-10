/**
 * @file HandlerConstants.js
 * @description Centralized constants for handlers (pagination, timeouts, limits)
 * @responsibility Define all magic numbers used across handlers in one place
 * 
 * @architecture Hexagonal Architecture - Application Layer Constants
 * @pattern Configuration Pattern - Centralized configuration values
 * 
 * @usage
 * import { PAGINATION, TIMEOUTS, LIMITS } from './HandlerConstants.js';
 * const itemsPerPage = PAGINATION.ITEMS_PER_PAGE;
 * 
 * @benefits
 * - Single source of truth for configuration values
 * - Easy to modify limits across entire application
 * - Better maintainability
 * - Clearer code intent
 */

/**
 * Pagination constants
 */
export const PAGINATION = {
    /**
     * Default items per page for game/product lists
     */
    ITEMS_PER_PAGE: 10,

    /**
     * Maximum page number allowed (prevent overflow)
     */
    MAX_PAGE: 20,

    /**
     * Default page when not specified
     */
    DEFAULT_PAGE: 1
};

/**
 * Time constants (in milliseconds)
 */
export const TIMEOUTS = {
    /**
     * Payment expiry time (24 hours)
     */
    PAYMENT_EXPIRY_MS: 24 * 60 * 60 * 1000, // 24 hours

    /**
     * Session timeout (30 minutes)
     */
    SESSION_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes

    /**
     * API request timeout (10 seconds)
     */
    API_TIMEOUT_MS: 10 * 1000 // 10 seconds
};

/**
 * Numeric parsing constants
 */
export const PARSING = {
    /**
     * Radix for parseInt (base 10)
     */
    DECIMAL_RADIX: 10
};

/**
 * Display limits
 */
export const LIMITS = {
    /**
     * Maximum transaction history to display
     */
    MAX_HISTORY_ITEMS: 10,

    /**
     * Maximum error message length
     */
    MAX_ERROR_LENGTH: 500,

    /**
     * Maximum retries for API calls
     */
    MAX_API_RETRIES: 3
};

/**
 * Application-level cooldowns (in milliseconds)
 * Note: Primary rate limiting is handled by nginx.
 * These are for preventing UI spam (rapid button clicks).
 */
export const COOLDOWNS = {
    /** Cooldown for expensive operations like history fetch, status check */
    ACTION_COOLDOWN_MS: 2000, // 2 seconds
};

/**
 * Default values
 */
export const DEFAULTS = {
    /**
     * Default parse mode for messages
     */
    PARSE_MODE: 'Markdown',

    /**
     * Default web page preview setting
     */
    DISABLE_WEB_PREVIEW: false
};
