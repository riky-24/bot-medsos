import { validateGameId } from '../config/GameValidationSchema.js';

/**
 * InputValidationService
 * Responsibility: Detect user intent and validate input data at the domain level.
 * Independent of the interface (Telegram, Web, etc.)
 */
export class InputValidationService {
    constructor(sanitizer, config = {}) {
        this.sanitizer = sanitizer;
        this.exitKeywords = config.exitKeywords || ['batal', 'cancel', 'keluar', 'exit', 'menu', 'stop', 'clear', 'restart', 'ulang'];
        this.greetings = config.greetings || ['halo', 'hai', 'hi', 'hello', 'hey', 'pagi', 'siang', 'malam', 'sore', 'p', 'assalamualaikum'];
        this.blacklist = config.blacklist || ['kontol', 'memek', 'jembut', 'anjing', 'babi', 'monyet', 'goblog', 'goblok', 'tolol', 'bajingan', 'bangsat', 'tai', 'pantek'];
    }

    /**
     * Process raw input and determine the intent
     * @param {string} text - Raw user input
     * @param {string|null} gameCode - Current game code if session exists
     * @returns {Object} - { type: 'data'|'command'|'ignore', payload: any, validation: Object|null }
     */
    async getResult(text, gameCode = null) {
        if (!text || typeof text !== 'string') {
            return { type: 'ignore', reason: 'empty_input' };
        }

        const cleanedText = text.trim();
        const lowText = cleanedText.toLowerCase();

        // 1. Check for Command/Exit Intent
        if (this.exitKeywords.includes(lowText) || cleanedText.startsWith('/')) {
            // If it's a known exit keyword, we explicitly mark it as cancel
            const isCancel = this.exitKeywords.includes(lowText) || lowText === '/cancel';
            return {
                type: 'command',
                action: isCancel ? 'cancel' : 'general',
                command: cleanedText.startsWith('/') ? cleanedText.split(/\s+/)[0] : null
            };
        }

        // 2. Check for Greetings/Ignore Intent
        if (this.greetings.includes(lowText)) {
            return { type: 'ignore', reason: 'greeting' };
        }

        // 3. Check for Conversational Intent (Indonesian Context)
        if (this.sanitizer.isConversational(cleanedText)) {
            return { type: 'ignore', reason: 'conversational' };
        }

        // 3a. Check Blacklist (Anti-Toxic)
        if (this.blacklist.some(badWord => lowText.includes(badWord))) {
            return { type: 'ignore', reason: 'blacklist_word' };
        }

        // 4. Data Intent (Potential Player ID)
        // Apply specialized cleaning if schema exists (e.g. for ML formatting)
        let normalizedText = cleanedText;
        const { GAME_VALIDATION_SCHEMAS } = await import('../config/GameValidationSchema.js');
        const schema = gameCode ? GAME_VALIDATION_SCHEMAS[gameCode] : null;

        if (schema && schema.clean) {
            normalizedText = schema.clean(cleanedText);
        }

        const words = normalizedText.split(/\s+/);
        const userIdRaw = words[0];
        const zoneIdRaw = words.slice(1).join(" ");

        const userId = this.sanitizer.cleanAlphanumeric(userIdRaw, 30);
        const zoneId = zoneIdRaw ? this.sanitizer.cleanAlphanumeric(zoneIdRaw, 20) : null;

        // Validation against Schema if gameCode is provided
        let validation = null;
        if (gameCode) {
            validation = validateGameId(cleanedText, gameCode);

            // FALLBACK: If validation helper returns "Default True" (meaning no schema found), 
            // we enforce a STRICT DEFAULT RULE: Must be Numeric Only.
            if (validation.isValid && !GAME_VALIDATION_SCHEMAS[gameCode]) {
                const defaultNumericPattern = /^\d+$/;
                if (!defaultNumericPattern.test(cleanedText)) {
                    validation = {
                        isValid: false,
                        error: "⚠️ Format salah. Untuk game ini, harap masukkan **ID Angka Saja**."
                    };
                }
            }
        }

        // ZERO TOLERANCE: If it's not conversational and not a command, it's DATA
        // Even if it's poorly formatted, we classify as data so the specialized 
        // Session Guard can reject it with a clean message instead of letting it hit AI/Fallback.
        return {
            type: 'data',
            payload: { userId, zoneId },
            validation: validation // { isValid, error }
        };
    }
}
