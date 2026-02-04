/**
 * Core Security Permissions
 * Definisi granular permission untuk sistem Bot Medsos.
 * Format: resource:action
 */

export const PERMISSIONS = {
    // General
    ACCESS_BOT: 'bot:access',

    // Game Context
    GAME_LIST: 'game:list',
    GAME_PLAY: 'game:play',
    GAME_CREATE_SESSION: 'game:create_session',
    GAME_JOIN_SESSION: 'game:join_session',

    // Payment Context
    PAYMENT_CREATE: 'payment:create',
    PAYMENT_HISTORY: 'payment:history',

    // User Profile
    PROFILE_VIEW: 'profile:view',
    PROFILE_UPDATE: 'profile:update',

    // Admin/System (Reserved for future)
    SYSTEM_MAINTENANCE: 'system:maintenance'
};

/**
 * Mendapatkan permission yang dibutuhkan untuk sebuah command/action
 * @param {string} commandName 
 * @returns {string} permission
 */
export const getPermissionForCommand = (commandName) => {
    // Mapping command ke permission (bisa di-extend)
    const mapping = {
        '/start': PERMISSIONS.ACCESS_BOT,
        '/menu': PERMISSIONS.ACCESS_BOT,
        '/play': PERMISSIONS.GAME_PLAY,
        '/topup': PERMISSIONS.PAYMENT_CREATE,
        '/profile': PERMISSIONS.PROFILE_VIEW
    };
    return mapping[commandName] || PERMISSIONS.ACCESS_BOT;
};
