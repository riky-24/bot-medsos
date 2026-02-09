
// Core Imports
import { BotCore } from '../core/applications/bot-telegram/BotCore.js';
import logger from '../core/shared/services/Logger.js';

// Adapter Imports
import { PrismaAdapter } from '../adapters/shared/database/PrismaAdapter.js';
import { TelegramAdapter } from '../adapters/bot-telegram/telegram/TelegramAdapter.js';
import { VIPResellerAdapter } from '../adapters/shared/game-providers/VIPResellerAdapter.js';
import { SakurupiahAdapter } from '../adapters/shared/payment/SakurupiahAdapter.js';
import { SakurupiahCallbackHandler } from '../adapters/shared/payment/SakurupiahCallbackHandler.js';
import { CloudflareTunnelAdapter } from '../adapters/platform/CloudflareTunnelAdapter.js';

// Repository Imports
import { UserRepository } from '../core/shared/repositories/UserRepository.js';
import { SessionRepository } from '../core/shared/repositories/SessionRepository.js';
import { PaymentChannelRepository } from '../core/shared/repositories/PaymentChannelRepository.js';
import { TransactionRepository } from '../core/shared/repositories/TransactionRepository.js';
import { GameRepository } from '../core/shared/repositories/GameRepository.js';

// Service Imports
import { SessionService } from '../core/shared/services/SessionService.js';
import { AuthenticationService } from '../core/applications/bot-telegram/security/authn/AuthenticationService.js';
import { AuthorizationGuard } from '../core/applications/bot-telegram/security/authz/AuthorizationGuard.js';
import { GameProviderService } from '../core/shared/services/GameProviderService.js';
import { GameService } from '../core/shared/services/GameService.js';
import { PaymentService } from '../core/shared/services/PaymentService.js';
import { GameSyncService } from '../core/shared/services/GameSyncService.js';
import { HealthCheckService } from '../core/shared/health/HealthCheckService.js';

// Server Imports
import express from 'express';
import dotenv from 'dotenv';

// Config Import
import { AppConfig } from '../core/shared/config/AppConfig.js';

// Message Templates Import (CRITICAL: Must wire to config)
import { MESSAGES } from '../core/applications/bot-telegram/config/messages.js';

// Load Environment Variables
// Load Environment Variables
// Priority: System Env > .env.{NODE_ENV} > .env
const envFile = process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : '.env';
dotenv.config({ path: envFile });

// Fallback: also load .env for shared variables if not in specific file
if (process.env.NODE_ENV) {
    dotenv.config({ path: '.env' });
}

// Validate required environment variables (fail-fast)
AppConfig.validate();

/**
 * Dependency Injection Wiring
 * 
 * This file acts as the Composition Root.
 * It manually instantiates all classes (Pure DI) and wires them together.
 */
async function bootstrap() {
    try {
        logger.info('🚀 Starting Bot Medsos Application...');

        // 1. Initialize Adapters (Infrastructure Layer)
        const prismaAdapter = new PrismaAdapter();
        const telegramAdapter = new TelegramAdapter(AppConfig.telegram.token);

        // Use AppConfig for game provider configuration
        const gameProviderAdapter = new VIPResellerAdapter(
            AppConfig.gameProvider.vipreseller.apiKey,
            AppConfig.gameProvider.vipreseller.apiId
        );

        // Use AppConfig for payment gateway configuration
        const paymentAdapter = new SakurupiahAdapter(
            AppConfig.payment.sakurupiah.apiKey,
            {
                apiId: AppConfig.payment.sakurupiah.apiId,
                baseUrl: AppConfig.payment.sakurupiah.baseUrl
            }
        );

        // 2. Initialize Repositories (Data Access Layer)
        // These wrap the Prisma Client
        const userRepository = new UserRepository(prismaAdapter);
        const sessionRepository = new SessionRepository(prismaAdapter);
        const paymentChannelRepository = new PaymentChannelRepository(prismaAdapter);
        const transactionRepository = new TransactionRepository(prismaAdapter);
        const gameRepository = new GameRepository(prismaAdapter);

        // 3. Initialize Domain Services (Business Logic Layer)
        // Services depend on Repositories and Adapters

        const sessionService = new SessionService(sessionRepository);

        const authenticationService = new AuthenticationService(
            userRepository,
            sessionService,
            { sessionDurationHours: 24 * 7 }
        );

        const authZ = new AuthorizationGuard(userRepository);

        const gameProviderService = new GameProviderService(gameProviderAdapter);

        const gameService = new GameService(gameRepository);

        const paymentService = new PaymentService(
            paymentAdapter,
            paymentChannelRepository,
            transactionRepository,
            gameProviderService
        );

        // 4. Initialize Core Application
        // BotCore Orchestrates the Use Cases

        // Webhook secret - prioritize TELEGRAM_WEBHOOK_SECRET for consistency
        const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;

        const botConfig = {
            adminChatId: process.env.ADMIN_CHAT_ID,
            webhookUrl: process.env.WEBHOOK_URL || process.env.APP_BASE_URL || 'https://bot.opinionry.my.id',
            webhookOptions: {
                secret_token: webhookSecret
            },
            webhookSecret: webhookSecret,
            // CRITICAL FIX: Spread MESSAGES object so handlers can access all message templates
            messages: {
                ...MESSAGES,
                // Allow env overrides for bot profile
                BOT_DESCRIPTION: process.env.BOT_DESCRIPTION || MESSAGES.BOT_DESCRIPTION,
                BOT_ABOUT: process.env.BOT_ABOUT || MESSAGES.BOT_ABOUT
            }
        };

        const bot = new BotCore(
            telegramAdapter,
            {
                databasePort: prismaAdapter,
                paymentService,
                gameProviderService,
                gameService,
                sessionService,
                authenticationService, // AuthN
                authPort: authZ        // AuthZ
                // callbackHandler will be added later due to circular dependency
            },
            botConfig
        );

        // 5. Initialize Handlers (that need BotCore)
        const paymentCallbackHandler = new SakurupiahCallbackHandler(
            process.env.SAKURUPIAH_API_KEY,
            bot
        );

        // Inject back into bot (property assignment)
        bot.callbackHandler = paymentCallbackHandler;

        // 7. Setup Express Server (HTTP Entry Point)
        const app = express();
        const PORT = process.env.PORT || 3000;

        // 6. Infrastructure (Hexagonal: Outer Layer)
        // Cloudflare Tunnel (Managed infrastructure)
        const tunnelAdapter = new CloudflareTunnelAdapter({
            token: process.env.CLOUDFLARE_TUNNEL_TOKEN,
            port: PORT
        });

        // SAFETY: Only auto-start tunnel if explicitly enabled in env
        if (process.env.ENABLE_AUTO_TUNNEL === 'true') {
            await tunnelAdapter.start();
        } else {
            logger.info('[Infra] Cloudflare Tunnel auto-start disabled (ENABLE_AUTO_TUNNEL!=true)');
        }

        // Middleware to handle Raw Body for webhook/callback signatures
        app.use(express.json({
            verify: (req, res, buf) => {
                req.rawBody = buf.toString();
            }
        }));

        // Health Check Service (Production-ready with K8s probes)
        const healthService = new HealthCheckService();
        healthService.register('database', async () => {
            const ok = await prismaAdapter.healthCheck();
            return { status: ok ? 'healthy' : 'unhealthy' };
        });
        healthService.register('telegram', async () => {
            return { status: 'healthy', mode: 'webhook' };
        }, false); // non-critical

        // Liveness Probe (K8s) - Process is alive
        app.get('/health/live', (req, res) => res.json(healthService.getLiveness()));

        // Readiness Probe (K8s) - Ready to receive traffic
        app.get('/health/ready', async (req, res) => res.json(await healthService.getReadiness()));

        // Full Health Report
        app.get('/health', async (req, res) => res.json(await healthService.runAll()));

        // Nginx/Docker Healthcheck specific endpoint
        app.get('/health/nginx', (req, res) => res.send('app ok'));

        // Telegram Webhook
        app.post('/webhook/telegram', (req, res) => {
            // Log incoming request
            logger.info('📩 Webhook POST received', {
                ip: req.ip,
                contentLength: req.headers['content-length']
            });

            // Validate secret token from Telegram
            const secretToken = req.headers['x-telegram-bot-api-secret-token'];
            if (secretToken !== botConfig.webhookSecret) {
                logger.warn('⛔ Webhook unauthorized: Invalid Secret Token', {
                    received: secretToken,
                    expected: botConfig.webhookSecret
                });
                return res.sendStatus(403);
            }

            // Fire and forget processing
            bot.handleWebhookRequest(req.headers, req.body);
            // Always respond 200 OK immediately to Telegram
            if (!res.headersSent) res.sendStatus(200);
        });

        // Payment Callback
        app.post('/callback/payment', (req, res) => {
            paymentCallbackHandler.handleExpressRequest(req, res);
        });

        // Legacy/Generic Callback Endpoint (Optional)
        app.post('/callback', (req, res) => {
            paymentCallbackHandler.handleExpressRequest(req, res);
        });

        // Game Sync Service (Admin Only)
        const gameSyncService = new GameSyncService(gameProviderService, gameRepository);

        app.post('/admin/sync-games', async (req, res) => {
            try {
                logger.info('[Admin] Game sync triggered...');
                const result = await gameSyncService.syncAll();
                res.json({ success: true, ...result });
            } catch (error) {
                logger.error('[Admin] Game sync failed:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Start Server
        app.listen(PORT, async () => {
            logger.info(`✅ Server running on port ${PORT}`);

            // Connect Database & Start Bot
            try {
                await bot.start();
                logger.info('🤖 Bot System Started via Webhook!');
            } catch (err) {
                logger.error('❌ Failed to start bot:', err);
                process.exit(1);
            }
        });

        // Graceful Shutdown
        const shutdown = async () => {
            logger.info('🛑 Shutting down...');
            await bot.stop();
            await prismaAdapter.disconnect();

            // Stop Infrastructure
            await tunnelAdapter.stop();

            process.exit(0);
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

    } catch (error) {
        logger.error('🔥 Fatal Bootstrap Error:', error);
        process.exit(1);
    }
}

// Execute Bootstrap
bootstrap();
