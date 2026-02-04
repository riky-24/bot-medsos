import { GAME_NORMALIZATION_RULES } from '../config/gameNormalization.js';
import logger from './Logger.js';

/**
 * GameSyncService
 * Handles synchronization of game data from provider to database
 * Uses normalization logic to ensure clean data
 */
export class GameSyncService {
  constructor(gameProviderService, gameRepository) {
    this.provider = gameProviderService;
    this.repo = gameRepository;
  }

  /**
   * Sync all available games and services from provider
   * @returns {Promise<Object>} Sync statistics
   */
  async syncAll() {
    logger.info('🔄 [GameSync] Starting full synchronization (Clean Sync)...');
    const stats = {
      gamesProcessed: 0,
      servicesSynced: 0,
      gamesCreated: 0,
      errors: 0,
      details: []
    };

    try {
      // Iterate targets from normalization config
      const targetGames = GAME_NORMALIZATION_RULES;

      for (const rule of targetGames) {
        await this._syncGame(rule, stats);
      }

      logger.info('✅ [GameSync] Sync completed!', stats);
      return stats;

    } catch (error) {
      logger.error('❌ [GameSync] Fatal error:', error);
      stats.errors++;
      throw error;
    }
  }

  /**
   * Sync a specific game target
   * @private
   */
  async _syncGame(rule, stats) {
    try {
      logger.info(`⏳ [GameSync] Syncing ${rule.name} (${rule.targetCode})...`);

      // 1. Ensure Game exists in DB
      const gameData = {
        code: rule.targetCode,
        name: rule.name,
        brand: rule.brand,
        category: rule.category,
        provider: 'vipreseller',
        isActive: true
      };

      const game = await this.repo.getOrCreateGame(gameData);

      // Check if newly created (approximate check)
      const isNew = new Date(game.createdAt).getTime() > Date.now() - 10000;
      if (isNew) stats.gamesCreated++;
      stats.gamesProcessed++;

      // 2. Fetch services from provider using syncBrand (filter_value)
      const searchKeyword = rule.syncBrand || rule.name.split(':')[0];
      const rawServices = await this.provider.getAvailablePackages(searchKeyword);

      if (rawServices.length === 0) {
        logger.debug(`   [GameSync] Provider returned 0 items for keyword: ${searchKeyword}`);
      } else {
        logger.debug(`   [GameSync] Provider returned ${rawServices.length} raw services for ${searchKeyword}`);
        // Log first item if exists for debugging
        if (rawServices[0]) {
          logger.debug(`   [GameSync] Sample raw service: ${JSON.stringify({ game: rawServices[0].game, name: rawServices[0].name })}`);
        }
      }

      // 3. Filter and Normalize
      const validServices = [];

      for (const raw of rawServices) {
        // VIPReseller returns { game: "Mobile Legends B", ... }
        // Check if this specific service belongs to our target rule rules
        const rawGameName = raw.game;

        // Exclude check
        const isExcluded = rule.excludePatterns.some(p => p.test(rawGameName));
        if (isExcluded) continue;

        // Include check
        const isMatch = rule.patterns.some(p => p.test(rawGameName));

        if (isMatch) {
          validServices.push(raw);
        }
      }

      if (validServices.length > 0) {
        // 4. Save to DB
        await this.repo.syncGameServices(game.id, validServices);

        stats.servicesSynced += validServices.length;
        logger.info(`   ✓ Synced ${validServices.length} services for ${rule.name}`);

        stats.details.push({
          game: rule.name,
          count: validServices.length,
          status: 'success'
        });
      } else {
        logger.warn(`   ⚠️ No services found for ${rule.name} (Filter: ${searchKeyword})`);
        stats.details.push({
          game: rule.name,
          count: 0,
          status: 'empty'
        });
      }

    } catch (error) {
      logger.error(`❌ [GameSync] Error syncing ${rule.name}: ${error.message}`);
      stats.errors++;
      stats.details.push({
        game: rule.name,
        status: 'error',
        error: error.message
      });
    }
  }
}
