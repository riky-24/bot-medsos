/**
 * @file RouterResponse.js
 * @description Standardized response objects for router return values
 * @responsibility Provide consistent, type-safe response structure across all routers
 * 
 * @architecture Hexagonal Architecture - Application Layer Utility
 * @pattern Factory Pattern - Static methods create standardized responses
 * 
 * @example
 * // Instead of: return { toast: "Success" }
 * return RouterResponse.toast("Success");
 * 
 * // Instead of: return { delegateTo: 'paymentChannel', mode: 'payment', chatId, messageId }
 * return RouterResponse.delegate('paymentChannel', { mode: 'payment', chatId, messageId });
 * 
 * // Instead of: return { status: 'handled', view: 'main' }
 * return RouterResponse.handled('main');
 * 
 * @benefits
 * - Type safety via JSDoc
 * - Consistent structure across routers
 * - Easy to extend with new response types
 * - Self-documenting API
 * 
 * @related
 * - CallbackRouter.js - Uses RouterResponse
 * - MenuRouter.js - Uses RouterResponse
 * - ActionRouter.js - Uses RouterResponse
 */

/**
 * @typedef {Object} ToastResponse
 * @property {string} toast - Message to show as toast notification
 */

/**
 * @typedef {Object} DelegateResponse
 * @property {string} delegateTo - Target handler to delegate to
 * @property {string} [mode] - Optional mode parameter
 * @property {string} [chatId] - Chat ID for delegation
 * @property {number} [messageId] - Message ID for delegation
 * @property {Object} [params] - Additional params for delegation
 */

/**
 * @typedef {Object} HandledResponse
 * @property {string} status - Status of the operation ('handled')
 * @property {string} [view] - Optional view identifier
 * @property {Object} [data] - Optional response data
 */

/**
 * @typedef {Object} ErrorResponse
 * @property {string} error - Error message
 * @property {string} [code] - Optional error code
 */

export class RouterResponse {
    /**
     * Create a toast response (for callback query answers)
     * @param {string} message - Toast message (empty string stops spinner)
     * @param {Object} [options] - Additional options
     * @param {boolean} [options.showAlert] - Show as alert instead of toast
     * @returns {ToastResponse}
     */
    static toast(message = '', options = {}) {
        const response = { toast: message };
        if (options.showAlert) {
            response.showAlert = true;
        }
        return response;
    }

    /**
     * Create a delegation response (route to another handler)
     * @param {string} target - Target handler name
     * @param {Object} params - Delegation parameters
     * @param {string} [params.mode] - Mode for target handler
     * @param {string} [params.chatId] - Chat ID
     * @param {number} [params.messageId] - Message ID
     * @returns {DelegateResponse}
     */
    static delegate(target, params = {}) {
        return {
            delegateTo: target,
            ...params
        };
    }

    /**
     * Create a handled response (operation completed successfully)
     * @param {string} [view] - View identifier
     * @param {Object} [data] - Additional response data
     * @returns {HandledResponse}
     */
    static handled(view = null, data = {}) {
        const response = { status: 'handled' };
        if (view) {
            response.view = view;
        }
        if (Object.keys(data).length > 0) {
            response.data = data;
        }
        return response;
    }

    /**
     * Create an error response
     * @param {string} message - Error message
     * @param {string} [code] - Error code
     * @returns {ErrorResponse}
     */
    static error(message, code = null) {
        const response = { error: message };
        if (code) {
            response.code = code;
        }
        return response;
    }

    /**
     * Create a success response with data
     * @param {Object} data - Success data
     * @param {string} [message] - Optional success message
     * @returns {Object}
     */
    static success(data = {}, message = null) {
        const response = {
            status: 'success',
            data
        };
        if (message) {
            response.message = message;
        }
        return response;
    }

    /**
     * Create an empty/silent response (no action needed)
     * Useful when operation is complete but no toast/feedback needed
     * @returns {Object}
     */
    static silent() {
        return { status: 'silent' };
    }

    /**
     * Validate if response is a valid RouterResponse type
     * @param {*} response - Response to validate
     * @returns {boolean} - True if valid
     */
    static isValid(response) {
        if (!response || typeof response !== 'object') {
            return false;
        }

        // Check for valid response types
        const hasToast = 'toast' in response;
        const hasDelegateTo = 'delegateTo' in response;
        const hasStatus = 'status' in response;
        const hasError = 'error' in response;

        return hasToast || hasDelegateTo || hasStatus || hasError;
    }

    /**
     * Get response type from response object
     * @param {Object} response - Response object
     * @returns {string} - Response type ('toast', 'delegate', 'handled', 'error', 'unknown')
     */
    static getType(response) {
        if (!response || typeof response !== 'object') {
            return 'unknown';
        }

        if ('toast' in response) return 'toast';
        if ('delegateTo' in response) return 'delegate';
        if ('error' in response) return 'error';
        if ('status' in response) {
            if (response.status === 'handled') return 'handled';
            if (response.status === 'success') return 'success';
            if (response.status === 'silent') return 'silent';
            return response.status;
        }
        return 'unknown';
    }
}
