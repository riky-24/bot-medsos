/**
 * GameRepository
 * Handles all game-related database operations
 * Manages brands and game services from VIPReseller
 */
export class GameRepository {
  constructor(prismaAdapter) {
    this.prisma = prismaAdapter.client;
  }

  /**
   * Get or create a brand by code
   */
  async getOrCreateBrand(brandData) {
    return await this.prisma.brand.upsert({
      where: { code: brandData.code },
      update: {
        name: brandData.name,
        categories: brandData.categories || [],
        updatedAt: new Date()
      },
      create: {
        code: brandData.code,
        name: brandData.name,
        provider: brandData.provider || 'vipreseller',
        categories: brandData.categories || []
      }
    });
  }

  /**
   * Find brand by code
   */
  async findByCode(code) {
    return await this.prisma.brand.findUnique({
      where: { code },
      include: { services: true }
    });
  }

  /**
   * Get all brands
   */
  async getAllBrands() {
    return await this.prisma.brand.findMany({
      include: {
        services: {
          orderBy: { priceBasic: 'asc' }
        }
      }
    });
  }

  /**
   * Sync game services for a brand
   * @param {String} brandId - Brand ID
   * @param {Array} servicesFromAPI - Array of services from VIPReseller
   */
  async syncBrandServices(brandId, servicesFromAPI) {
    const operations = servicesFromAPI.map(service => {
      return this.prisma.gameService.upsert({
        where: { code: service.code },
        update: {
          serviceName: service.name,
          category: service.category,
          priceBasic: service.priceBasic,
          pricePremium: service.pricePremium,
          priceSpecial: service.priceSpecial,
          description: service.description || '',
          server: service.server || null,
          lastSynced: new Date(),
          updatedAt: new Date()
        },
        create: {
          brandId,
          code: service.code,
          serviceName: service.name,
          category: service.category,
          priceBasic: service.priceBasic,
          pricePremium: service.pricePremium,
          priceSpecial: service.priceSpecial,
          description: service.description || '',
          server: service.server || null,
          lastSynced: new Date()
        }
      });
    });

    return await this.prisma.$transaction(operations);
  }

  /**
   * Get services for a brand
   */
  async getBrandServices(brandCode) {
    const brand = await this.findByCode(brandCode);
    if (!brand) return [];

    return await this.prisma.gameService.findMany({
      where: {
        brandId: brand.id
      },
      orderBy: { priceBasic: 'asc' }
    });
  }

  /**
   * Get services for a brand by category
   */
  async getBrandServicesByCategory(brandCode, category) {
    const brand = await this.findByCode(brandCode);
    if (!brand) return [];

    return await this.prisma.gameService.findMany({
      where: {
        brandId: brand.id,
        category: category
      },
      orderBy: { priceBasic: 'asc' }
    });
  }

  /**
   * Find service by code
   */
  async findServiceByCode(code) {
    return await this.prisma.gameService.findUnique({
      where: { code },
      include: { brand: true }
    });
  }

  /**
   * Save or update game account
   */
  async saveGameAccount(accountData) {
    return await this.prisma.gameAccount.upsert({
      where: {
        userId_gameCode_playerId: {
          userId: accountData.userId.toString(),
          gameCode: accountData.gameCode,
          playerId: accountData.playerId
        }
      },
      update: {
        nickname: accountData.nickname,
        zoneId: accountData.zoneId,
        lastValidated: new Date(),
        updatedAt: new Date()
      },
      create: {
        userId: accountData.userId.toString(),
        gameCode: accountData.gameCode,
        playerId: accountData.playerId,
        zoneId: accountData.zoneId,
        nickname: accountData.nickname,
        isVerified: true,
        lastValidated: new Date()
      }
    });
  }

  /**
   * Get user's game accounts
   */
  async getUserGameAccounts(userId) {
    return await this.prisma.gameAccount.findMany({
      where: { userId: userId.toString() },
      orderBy: { lastValidated: 'desc' }
    });
  }
}
