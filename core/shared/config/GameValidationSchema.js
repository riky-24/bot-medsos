/**
 * Game Validation Schemas
 * 
 * Defines local regex patterns for popular games to prevent 
 * invalid API calls and provide immediate feedback.
 */

export const GAME_VALIDATION_SCHEMAS = {
    // MOBA
    'mobile-legends': {
        name: 'Mobile Legends',
        pattern: /^\d{5,12}\s*\(?\d{3,6}\)?$/,
        example: '12345678 (1234)',
        clean: (text) => text.replace(/[()]/g, ' ').trim().split(/\s+/).join(' ')
    },
    'arena-of-valor': {
        name: 'AOV',
        pattern: /^\d{5,18}$/,
        example: '123456781234567'
    },
    'league-of-legends-wild-rift': {
        name: 'Wild Rift',
        pattern: /^.+#\w{2,6}$/,
        example: 'RiotUser#WR1'
    },
    'marvel-super-war': {
        name: 'Marvel Super War',
        pattern: /^\d{5,18}$/,
        example: '12345678'
    },

    // BATTLE ROYALE / FPS
    'free-fire': {
        name: 'Free Fire',
        pattern: /^\d{8,14}$/,
        example: '1234567890'
    },
    'free-fire-max': {
        name: 'Free Fire Max',
        pattern: /^\d{8,14}$/,
        example: '1234567890'
    },
    'pubgm': {
        name: 'PUBG Mobile',
        pattern: /^\d{5,14}$/,
        example: '5123456789'
    },
    'call-of-duty-mobile': {
        name: 'CODM',
        pattern: /^\d{10,25}$/,
        example: '123456789012345678'
    },
    'valorant': {
        name: 'Valorant',
        pattern: /^.+#\w{2,6}$/,
        example: 'RiotUser#ID1'
    },
    'point-blank': {
        name: 'Point Blank',
        pattern: /^[a-zA-Z0-9._-]{3,20}$/,
        example: 'PBUsername'
    },
    'bullet-angel': {
        name: 'Bullet Angel',
        pattern: /^\d{5,20}$/,
        example: '12345678'
    },

    // RPG
    'genshin-impact': {
        name: 'Genshin Impact',
        pattern: /^\d{9}\s*[a-zA-Z0-9_]*$/,
        example: '812345678 (os_asia)',
        clean: (text) => {
            let t = text.replace(/[()]/g, ' ').trim().split(/\s+/);
            const uid = t[0];
            let server = t[1] || '';
            const mapping = {
                'asia': 'os_asia', 'america': 'os_usa', 'usa': 'os_usa',
                'euro': 'os_euro', 'europe': 'os_euro', 'cht': 'os_cht',
                'tw': 'os_cht', 'hk': 'os_cht'
            };
            server = mapping[server.toLowerCase()] || server;
            return `${uid} ${server}`.trim();
        }
    },
    'ragnarok-m-eternal-love-big-cat-coin': {
        name: 'Ragnarok M',
        pattern: /^\d{5,15}$/,
        example: '12345678'
    },
    'laplace-m': {
        name: 'Laplace M',
        pattern: /^\d{5,15}$/,
        example: '12345678'
    },
    'dragon-raja': {
        name: 'Dragon Raja',
        pattern: /^\d{5,15}$/,
        example: '12345678'
    },

    // CASUAL / OTHERS
    'hago': {
        name: 'Hago',
        pattern: /^\d{5,15}$/,
        example: '1234567'
    },
    'zepeto': {
        name: 'Zepeto',
        pattern: /^[a-zA-Z0-9._]{3,20}$/,
        example: 'User.123'
    },
    'lords-mobile': {
        name: 'Lords Mobile',
        pattern: /^\d{5,15}$/,
        example: '12345678'
    },
    'higgs-domino': {
        name: 'Higgs Domino',
        pattern: /^\d{5,15}$/,
        example: '12345678'
    },
    'speed-drifters': {
        name: 'Speed Drifters',
        pattern: /^\d{5,15}$/,
        example: '12345678'
    },
    'tom-and-jerry-chase': {
        name: 'Tom & Jerry Chase',
        pattern: /^\d{5,15}$/,
        example: '12345678'
    },
    '8-ball-pool': {
        name: '8 Ball Pool',
        pattern: /^\d{5,15}$/,
        example: '12345678'
    },
    'auto-chess': {
        name: 'Auto Chess',
        pattern: /^\d{5,15}$/,
        example: '12345678'
    },
    'cocofun': {
        name: 'Cocofun',
        pattern: /^\d{5,15}$/,
        example: '12345678'
    },
    'indoplay': {
        name: 'IndoPlay',
        pattern: /^\d{5,15}$/,
        example: '12345678'
    },
    'domino-gaple-qiuqiu-boyaa': {
        name: 'Domino Gaple',
        pattern: /^\d{5,15}$/,
        example: '12345678'
    },
    'honor-of-kings': {
        name: 'Honor of Kings',
        pattern: /^\d{5,20}$/,
        example: '123456789'
    }
};

/**
 * Helper to validate text against a game schema
 * @param {string} text - Input text
 * @param {string} gameCode - Internal game code
 * @returns {Object} { isValid: boolean, error: string|null, cleanEmail: string }
 */
export function validateGameId(text, gameCode) {
    const schema = GAME_VALIDATION_SCHEMAS[gameCode];
    if (!schema) return { isValid: true, cleanText: text.trim() };

    const cleanText = schema.clean ? schema.clean(text) : text.trim();
    const isValid = schema.pattern.test(cleanText);

    return {
        isValid,
        cleanText,
        error: isValid ? null : `Format ID ${schema.name} salah. Contoh: ${schema.example}`
    };
}
