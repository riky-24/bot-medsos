/**
 * @file SessionInputHandler.js
 * @description Handles user text input when in session state (waiting for player ID/game ID)
 * @responsibility Validate input, check player nicknames via API, save to session, show confirmation
 * 
 * @requires SessionService - User session state management
 * @requires SendPort - Telegram bot messaging interface
 * @requires GameProviderService - External API for player validation
 * @requires GameService - Game data access
 * @requires InputValidationService - Input parsing and intent detection
 * @requires NicknameRateLimiter - Rate limiting for API calls
 * @requires UIPersistenceHelper - Single bubble UI experience
 * @requires AuthPort - Authorization service
 * @requires Sanitizer - Input sanitization (TODO: implement usage)
 * @requires Logger - Logging service
 * @requires PERMISSIONS - Authorization permissions
 * @requires GAME_VALIDATION_SCHEMAS - Local validation patterns (lazy loaded)
 * @requires GAME_NORMALIZATION_RULES - Game code mapping (lazy loaded)
 * 
 * @architecture Hexagonal Architecture - Application Layer
 * @pattern State Machine - Handles state-dependent input processing
 * 
 * @example
 * const handler = new SessionInputHandler(sessionService, sendPort, config, gameProviderService, ...);
 * const handled = await handler.handle(message);
 * // Returns true if input was handled, false otherwise
 * 
 * @input_flow
 * 1. Security check: Verify user not banned
 * 2. Intent detection: Command, ignore, or data
 * 3. Local validation: Check format against GAME_VALIDATION_SCHEMAS
 * 4. Rate limiting: Check API quota for nickname validation
 * 5. API validation: Verify player ID with game provider
 * 6. Session update: Save validated data
 * 7. Confirmation: Show player ID confirmation UI
 * 
 * @validation_layers
 * - Layer 1: Input intent classification (command/ignore/data)
 * - Layer 2: Local schema validation (regex pattern matching)
 * - Layer 3: Rate limiting (prevent API abuse)
 * - Layer 4: External API validation (nickname check)
 * 
 * @security
 * - Ban check via authPort.can(PERMISSIONS.ACCESS_BOT)
 * - Rate limiting for nickname API calls
 * - Input sanitization (TODO: currently unused Sanitizer import)
 * 
 * @related
 * - BotController.js - Routes messages to this handler when in session
 * - InputValidationService.js - Intent detection logic
 * - GameProviderService.js - External API integration
 */
import logger from '../../../../shared/services/Logger.js';

import { Sanitizer } from '../../../../shared/utils/Sanitizer.js';
import { PERMISSIONS } from '../../security/authz/permissions.js';
export class SessionInputHandler {
    /**
     * Constructor for SessionInputHandler
     * 
     * @param {Object} sessionService - User session state management
     * @param {Object} sendPort - Telegram bot messaging interface
     * @param {Object} config - Configuration object with messages
     * @param {Object} gameProviderService - External API for player validation
     * @param {Object} [gameService=null] - Game data access
     * @param {Object} [inputValidationService=null] - Input parsing and intent detection
     * @param {Object} [nicknameRateLimiter=null] - Rate limiting for API calls
     * @param {Object} [ui=null] - Pre-initialized UI helper
     * @param {Object} [authPort=null] - Authorization service
     */
    constructor(sessionService, sendPort, config, gameProviderService, gameService = null, inputValidationService = null, nicknameRateLimiter = null, ui = null, authPort = null) {
        this.sessionService = sessionService;
        this.sendPort = sendPort;
        this.messages = config?.messages;
        this.gameProviderService = gameProviderService;
        this.gameService = gameService;
        this.inputValidationService = inputValidationService;
        this.nicknameRateLimiter = nicknameRateLimiter;
        this.ui = ui;
        this.authPort = authPort;
    }

    /**
     * Handle input based on pending session
     * Processes command, ignore, and data intents for player validation
     * 
     * @param {Object} message - Message entity
     * @param {string} message.chatId - Telegram chat identifier
     * @param {number} message.messageId - Message ID
     * @param {string} message.text - User input text
     * @returns {Promise<boolean>} True if handled, false otherwise
     */
    async handle(message) {
        // SECURITY CHECK: Global Ban
        if (this.authPort && !await this.authPort.can({ id: message.chatId }, PERMISSIONS.ACCESS_BOT)) {
            // Silently ignore banned users in input handler to prevent spam loops
            return false;
        }

        if (!this.inputValidationService) return false;

        const pending = await this.sessionService.getPendingOrder(message.chatId);
        if (!pending) return false;

        // Intent Discovery (Modular Service)
        const result = await this.inputValidationService.getResult(message.text, pending.game);

        // 1. Command Intent
        if (result.type === 'command') {
            logger.info(`[SessionInput] Command detected for ${message.chatId}: ${message.text}. Breaking session.`);

            if (result.action === 'cancel') {
                // Edit bubble FIRST, then clear session
                await this.ui.sendOrEdit(message.chatId, this.messages.ORDER_CANCELLED || "Pesanan dibatalkan.");
                await this.sessionService.clearSession(message.chatId);
                return true;
            }

            // For other commands (/start, /menu, etc.), clear and let other handlers process
            await this.sessionService.clearSession(message.chatId);
            return false;
        }

        // 2. Ignore Intent (Greeting or Conversational)
        if (result.type === 'ignore') {
            logger.debug(`[SessionInput] Ignoring input for ${message.chatId}: ${result.reason}`);
            // If it's conversational, we delete the message to keep the UI clean
            await this.ui.deleteSilently(message.chatId, message.messageId);
            return false;
        }

        // 3. Data Intent (Potential Player ID)
        if (result.type !== 'data') return false;

        // --- NEW: Local Schema Validation ---
        if (result.validation && !result.validation.isValid) {
            // Comprehensive logging untuk debugging
            const { GAME_VALIDATION_SCHEMAS } = await import('../../../../shared/config/GameValidationSchema.js');
            const schema = GAME_VALIDATION_SCHEMAS[pending.game];
            logger.warn(`[SessionInput] ❌ LOCAL SCHEMA FAILED | ChatId: ${message.chatId} | Game: ${pending.game} | Input: "${message.text}" | Pattern: ${schema?.pattern || 'N/A'} | Expected: ${schema?.example || 'N/A'} | Error: ${result.validation.error}`);

            const schemaError = `⚠️ **FORMAT ID SALAH**\n\n${result.validation.error}`;
            const errorKeyboard = {
                inline_keyboard: [
                    [{ text: "❌ Batalkan", callback_data: "action_cancel" }]
                ]
            };

            // Delete user msg
            await this.ui.deleteSilently(message.chatId, message.messageId);

            await this.ui.sendOrEdit(message.chatId, schemaError, { reply_markup: errorKeyboard });
            return true;
        }

        const { userId, zoneId } = result.payload;
        logger.info(`[SessionInput] Validating Player ID: ${userId} for ${message.chatId}`);

        // Anti-Spam: Delete user's message to keep chat 1-bubble only
        await this.ui.deleteSilently(message.chatId, message.messageId);

        // Skip if input is identical to current pending (use new field name)
        if (pending.gamePlayerId === userId && (pending.zoneId || null) === (zoneId || null)) {
            logger.debug(`[SessionInput] Input identical for ${message.chatId}, skipping resend`);
            return true;
        }

        // 4. Real-time Provider Validation (Nickname Check)
        let nickname = null;
        if (this.gameProviderService && pending.game) {
            try {
                // Get Game data from DB to check for validationCode (Truly Dynamic Mapping)
                let validationCode = null;
                // 1. Get Game data from DB (Truly Dynamic & High Priority)
                if (this.gameService) {
                    const game = await this.gameService.findGameByCode(pending.game);
                    if (game && game.validationCode) {
                        validationCode = game.validationCode;
                    }
                }

                // 2. [FALLBACK] If DB doesn't have it, try normalization rules (Matches mapping in code)
                if (!validationCode) {
                    const { GAME_NORMALIZATION_RULES } = await import('../../../../shared/config/gameNormalization.js');
                    const rule = GAME_NORMALIZATION_RULES.find(r => r.targetCode === pending.game || r.providerCode === pending.game);
                    validationCode = rule?.validationCode || null;
                }

                if (validationCode) {
                    // --- FITUR CANGGIH: QUOTA GUARD (Proteksi API VIPReseller) ---
                    if (this.nicknameRateLimiter && !this.nicknameRateLimiter.canRequest(message.chatId)) {
                        logger.warn(`[SessionInput] ⚠️ Quota Guard: User ${message.chatId} hit nickname rate limit`);
                        const limitMsg = this.messages.ERR_NICKNAME_LIMIT || "⌛ Sabar ya Kak, jangan cepat-cepat cek ID.";
                        const limitKeyboard = {
                            inline_keyboard: [
                                [{ text: "❌ Batalkan", callback_data: "action_cancel" }]
                            ]
                        };

                        await this.ui.sendOrEdit(message.chatId, limitMsg, { reply_markup: limitKeyboard });
                        return true;
                    }

                    try {
                        const playerInfo = await this.gameProviderService.validatePlayer(validationCode, userId, zoneId);

                        if (playerInfo.success && playerInfo.nickname) {
                            nickname = playerInfo.nickname;
                            logger.info(`[SessionInput] ✅ API VALIDATION SUCCESS | ChatId: ${message.chatId} | Game: ${pending.game} | ValidationCode: ${validationCode} | PlayerId: ${userId} | ZoneId: ${zoneId || 'null'} | Nickname: ${nickname}`);
                        } else {
                            // Determine error type for logging
                            const isSystemError = playerInfo.message && (
                                playerInfo.message.includes('maintenance') ||
                                playerInfo.message.includes('limit') ||
                                playerInfo.message.includes('balance') ||
                                playerInfo.message.includes('IP') ||
                                playerInfo.message.includes('Signature')
                            );
                            const errorType = isSystemError ? 'SYSTEM_ERROR' : 'ID_NOT_FOUND';

                            // Comprehensive logging
                            logger.warn(`[SessionInput] ❌ API VALIDATION FAILED | ChatId: ${message.chatId} | Game: ${pending.game} | ValidationCode: ${validationCode} | PlayerId: ${userId} | ZoneId: ${zoneId || 'null'} | ErrorType: ${errorType} | APIMessage: ${playerInfo.message || 'N/A'}`);

                            const errorMsg = isSystemError
                                ? "⚠️ **GANGGUAN SYSTEM**\n\nMaaf Kak, fitur cek ID sedang gangguan di sistem provider. Silakan coba lagi nanti atau pastikan ID sudah benar."
                                : this.messages.ERR_ID_NOT_FOUND(userId, zoneId);
                            const idErrorKeyboard = {
                                inline_keyboard: [
                                    [{ text: "❌ Batalkan", callback_data: "action_cancel" }]
                                ]
                            };

                            await this.ui.sendOrEdit(message.chatId, errorMsg, { reply_markup: idErrorKeyboard });
                            return true;
                        }
                    } catch (apiError) {
                        // Comprehensive crash logging with stack trace
                        const stackLines = apiError.stack ? apiError.stack.split('\n').slice(0, 3).join(' | ') : 'N/A';
                        logger.error(`[SessionInput] 🔥 API CRASH | ChatId: ${message.chatId} | Game: ${pending.game} | ValidationCode: ${validationCode} | PlayerId: ${userId} | ZoneId: ${zoneId || 'null'} | Error: ${apiError.message} | Stack: ${stackLines}`);
                        // Don't block the order if API crashes, just continue without nickname to be safe
                        // but log it. Or we could block it if validation is mandatory.
                        // For now, we allow fallback for safety.
                    }
                }
            } catch (e) {
                logger.error(`[SessionInput] Validation error: ${e.message}`);
            }
        }

        // Update Session with new field names
        await this.sessionService.savePendingOrder(message.chatId, {
            ...pending,
            gamePlayerId: userId,  // NEW field name for game player ID
            zoneId: zoneId || null,
            nickname: nickname
        });

        // Reply with Confirmation Buttons
        const confirmationMsg = this.messages.CONFIRM_PLAYER_ID(userId, zoneId, nickname);
        const keyboard = {
            inline_keyboard: [
                [{ text: this.messages.BUTTON_CONFIRM_YES, callback_data: "action_confirm_id" }],
                [{ text: this.messages.BUTTON_CONFIRM_NO, callback_data: "action_cancel" }]
            ]
        };

        await this.ui.sendOrEdit(message.chatId, confirmationMsg, {
            reply_markup: keyboard,
            parse_mode: 'Markdown'
        });
        return true;
    }
}
