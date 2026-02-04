import { normalizeGameName, getGameConfigMap } from '../config/gameNormalization.js';

/**
 * GameService with Database Integration
 * Handles game queries from database with logic to group and enrich data
 */
export class GameService {
  constructor(gameRepository = null) {
    this.gameRepository = gameRepository;
  }

  /**
   * Get all available games enriched with normalization rules
   */
  async getAvailableGames() {
    if (!this.gameRepository) {
      return this.getStaticGames();
    }

    const brands = await this.gameRepository.getAllBrands();
    return brands.map(brand => {
      // Enrich with normalization rules
      const norm = normalizeGameName(brand.name) || {};

      return {
        code: brand.code,
        name: brand.name,
        category: norm.category || brand.categories?.[0],
        validationCode: brand.validationCode || norm.validationCode,
        emoji: norm.emoji || this.getEmojiByCode(brand.code),
        isGame: norm.isGame ?? true,
        priority: norm.priority ?? 0
      };
    }).sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
  }

  /**
   * Get games grouped by Professional Categories
   * 1. Verified Games (Support Nickname)
   * 2. Regular Games (No Nickname Check)
   * 3. Digital Vouchers & Others
   */
  async getGroupedAvailableGames() {
    const allGames = await this.getAvailableGames();

    return {
      verified: allGames.filter(g => g.isGame && g.validationCode),
      regular: allGames.filter(g => g.isGame && !g.validationCode),
      vouchers: allGames.filter(g => !g.isGame)
    };
  }

  /**
   * Find game by code
   */
  async findGameByCode(code) {
    if (!this.gameRepository) return null;
    return await this.gameRepository.findByCode(code);
  }

  /**
   * Get services for a brand
   */
  async getGameServices(gameCode) {
    if (!this.gameRepository) {
      return [];
    }
    return await this.gameRepository.getBrandServices(gameCode);
  }

  /**
   * Find specific service by code
   */
  async findServiceByCode(serviceCode) {
    if (!this.gameRepository) return null;
    return await this.gameRepository.findServiceByCode(serviceCode);
  }

  /**
   * Static game list (fallback)
   */
  getStaticGames() {
    const mapping = getGameConfigMap();
    return Object.entries(mapping).map(([code, info]) => ({
      code,
      name: info.name,
      category: info.category,
      emoji: info.emoji,
      validationCode: info.validationCode,
      isGame: info.isGame,
      priority: info.priority
    })).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get emoji by game code
   */
  getEmojiByCode(code) {
    const mapping = getGameConfigMap();
    const game = mapping[code];
    return game ? game.emoji : '🎮';
  }
}
