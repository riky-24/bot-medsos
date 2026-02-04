import { HandleMessageUseCase } from './useCases/HandleMessageUseCase.js';
import { CommandHandlers } from './useCases/CommandHandlers.js';
import { GameService } from '../../shared/services/GameService.js';
import { RateLimiter } from '../../shared/services/RateLimiter.js';
import { InputValidationService } from '../../shared/services/InputValidationService.js';
import { Sanitizer } from '../../shared/utils/Sanitizer.js';
import { RATE_LIMIT_MS } from '../../shared/config/constants.js';
import logger from '../../shared/services/Logger.js';

/**
 * BotCore - Application Core
 * 
 * This is the heart of the application that wires together all use cases and services.
 * It depends ONLY on core domain elements (services, use cases) via Dependency Injection.
 * 
 * NO ADAPTER IMPORTS - All adapters are injected via constructor.
 */
export class BotCore {
  constructor(sendPort, dependencies = {}, config = null) {
    this.sendPort = sendPort;
    this.commands = {};
    this.callbacks = {};
    this.config = config;

    // Extract dependencies
    const {
      databasePort,
      paymentService,
      gameProviderService,
      gameService,
      sessionService,
      authenticationService, // NEW: Authentication service
      authPort,              // Authorization guard
      callbackHandler
    } = dependencies;

    // Store dependencies
    // Infrastructure
    this.databasePort = databasePort;
    this.callbackHandler = callbackHandler;

    // Domain Services
    // Services are injected via constructor (DI)
    // We assume they are already wired with their requirements (Repositories/Ports)

    // GameProviderService is standalone
    this.gameProviderService = gameProviderService;
    this.gameService = gameService;

    this.sessionService = sessionService;
    this.paymentService = paymentService;

    // Security services
    this.authN = authenticationService; // Authentication
    this.authZ = authPort;               // Authorization

    // Initialize rate limiter (pure domain service, no external deps)
    this.rateLimiter = new RateLimiter({ limitMs: RATE_LIMIT_MS });

    // Quota Guard: 5 checks per 2 minutes per user (Fitur Canggih)
    this.nicknameRateLimiter = new RateLimiter({
      windowMs: 2 * 60 * 1000,
      maxRequests: 5
    });

    // Initialize Input Validation Service (Hexagonal Modular approach)
    this.inputValidationService = new InputValidationService(Sanitizer);

    // Initialize Core Command Handlers with config
    this.commandHandlers = new CommandHandlers(
      this,
      this.gameService,
      this.paymentService,
      config // NEW: Pass config
    );
    this.commandHandlers.registerCommands();


    // Initialize HandleMessageUseCase with modern dependency object
    this.handleMessageUseCase = new HandleMessageUseCase({
      sendPort: this.sendPort,
      commands: this.commands,
      commandHandlers: this.commandHandlers,
      rateLimiter: this.rateLimiter,
      sessionService: this.sessionService,
      gameProviderService: this.gameProviderService,
      gameService: this.gameService,
      inputValidationService: this.inputValidationService,
      nicknameRateLimiter: this.nicknameRateLimiter,
      config: this.config,
      authN: this.authN, // NEW: AuthN service
      authZ: this.authZ  // AuthZ guard (renamed from authPort)
    });
  }

  onCommand(command, callback) {
    this.commands[command] = callback;
  }

  async handleMessage(message) {
    await this.handleMessageUseCase.execute(message);
  }

  /**
   * Main entry point for Webhook requests (Centralized Handler)
   * @param {Object} headers - Request headers
   * @param {Object} body - Request body
   * @returns {Object} { status, message }
   */
  handleWebhookRequest(headers, body) {
    // 1. Security Check: Secret Token
    const clientToken = headers['x-telegram-bot-api-secret-token'];
    if (!this.validateWebhookToken(clientToken)) {
      logger.warn(`[BotCore] ⛔ Rejected webhook: Invalid Secret Token`);
      return { status: 403, message: 'Forbidden' };
    }

    // 2. Fire-and-Forget (Async Processing)
    // Don't await this! Return 200 immediately.
    this.processUpdate(body).catch(err => {
      logger.error(`[BotCore] Unhandled error in background processing: ${err.message}`);
    });

    return { status: 200, message: 'OK' };
  }

  validateWebhookToken(token) {
    if (!this.config?.webhookSecret) return true; // If no secret set, allow all (or warn?)
    return token === this.config.webhookSecret;
  }

  async processUpdate(rawUpdate) {
    try {
      // Use the adapter's logic to parse the raw update
      const message = this.sendPort.parseUpdate(rawUpdate);
      if (message) {
        await this.handleMessage(message);
      }
    } catch (error) {
      logger.error(`[BotCore] Error processing webhook update: ${error.message}`);
      // Notify Admin
      this.notifyAdmin(`🚨 **Bot Error Report**\n\n${error.message}\n\nStack:\n${error.stack ? error.stack.substring(0, 500) : 'No stack'}`);
    }
  }

  async notifyAdmin(text) {
    if (!this.config?.adminChatId || !this.sendPort) return;
    try {
      await this.sendPort.sendMessage(this.config.adminChatId, text, { parse_mode: 'Markdown' });
    } catch (e) {
      logger.error(`[BotCore] Failed to send admin alert: ${e.message}`);
    }
  }

  async start() {
    // Connect to database
    await this.databasePort.connect();

    // Sync Payment Channels on Startup
    try {
      await this.paymentService.syncPaymentChannels();
    } catch (e) {
      logger.warn(`[BotCore] Failed to sync payment channels: ${e.message}`);
    }

    // Start background tasks
    this._startBackgroundTasks();

    // Check for Webhook URL configuration
    const webhookUrl = this.config?.webhookUrl;

    if (!webhookUrl) {
      logger.error('[BotCore] Webhook URL not configured. Bot cannot start in pure webhook mode!');
      throw new Error('Webhook URL missing');
    }

    logger.info(`[BotCore] Starting in WEBHOOK mode. URL: ${webhookUrl}`);
    try {
      const options = this.config?.webhookOptions || {};
      await this.sendPort.setWebhook(`${webhookUrl}/webhook/telegram`, options);
      logger.info(`[BotCore] ✓ Webhook set successfully! (Secret: ${options.secret_token ? 'YES' : 'NO'})`);
    } catch (e) {
      logger.warn(`[BotCore] ⚠️ Failed to set webhook (Non-fatal): ${e.message}`);
      // Do NOT throw. Allow app to start so valid webhooks can still be received if manually set.
      // throw e; 
    }
  }

  /**
   * Start periodic background tasks
   * @private
   */
  _startBackgroundTasks() {
    // 1. Initial Cleanup & Profile Sync
    this.sessionService.cleanupExpiredSessions(24).catch(err => logger.error(`[BotCore] Initial cleanup failed: ${err.message}`));
    this.initializeBotProfile().catch(err => logger.error(`[BotCore] Profile sync failed: ${err.message}`));

    // Background cleanup tasks
    this.cleanupInterval = setInterval(async () => {
      logger.debug('[BotCore] Running scheduled cleanup...');

      // Cleanup expired sessions (includes auth state now)
      await this.sessionService.cleanupExpiredSessions(24);
    }, 60 * 60 * 1000); // Every hour
  }

  async initializeBotProfile() {
    if (!this.sendPort || !this.config?.messages) return;

    const { BOT_DESCRIPTION, BOT_ABOUT } = this.config.messages;

    try {
      if (BOT_DESCRIPTION) {
        await this.sendPort.setMyDescription(BOT_DESCRIPTION);
      }

      if (BOT_ABOUT) {
        await this.sendPort.setMyShortDescription(BOT_ABOUT);
      }

      logger.info('[BotCore] Bot profile (Description & Short Description) synced with Telegram');
    } catch (error) {
      logger.warn(`[BotCore] Failed to sync bot profile: ${error.message}`);
    }
  }

  async stop() {
    logger.info('[BotCore] Stopping bot...');

    // Clear intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    logger.info('[BotCore] Bot stopped gracefully');
  }
}
