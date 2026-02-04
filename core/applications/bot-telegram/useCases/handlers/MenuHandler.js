import { MENUS, generateTopUpMenu } from '../../config/menus.js';

/**
 * MenuHandler (Professional Hybrid UI)
 * Responsibility: Categorized Menu generation and navigation
 */
export class MenuHandler {
  constructor(gameService) {
    this.gameService = gameService;
  }

  /**
   * Get main menu keyboard
   */
  getMainMenu() {
    return MENUS.MAIN;
  }

  /**
   * Get Category Selection Menu (The "Professional" Entry Point)
   */
  getTopUpCategoryMenu() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔥 Game Terverifikasi", callback_data: "menu_topup_cat_verified" }],
          [{ text: "🎮 Game Lainnya", callback_data: "menu_topup_cat_regular" }],
          [{ text: "🎟️ Voucher & Digital", callback_data: "menu_topup_cat_vouchers" }],
          [{ text: "🔙 Kembali", callback_data: "menu_main" }]
        ]
      }
    };
  }

  /**
   * Generate dynamic top-up menu for a specific category
   * @param {String} category - 'verified', 'regular', 'vouchers'
   * @param {Number} page - Page number
   */
  async getGroupedTopUpMenu(category = 'verified', page = 1) {
    const grouped = await this.gameService.getGroupedAvailableGames();
    const games = grouped[category] || [];

    const result = generateTopUpMenu(games, page);

    // Customize callback data to preserve category during pagination
    // Format: menu_topup_cat_verified_page_2
    result.reply_markup.inline_keyboard = result.reply_markup.inline_keyboard.map(row => {
      return row.map(btn => {
        if (btn.callback_data?.startsWith('menu_topup_page_')) {
          const p = btn.callback_data.split('_').pop();
          return { ...btn, callback_data: `menu_topup_cat_${category}_page_${p}` };
        }
        // Back button in grouped menu should go back to category selection
        if (btn.callback_data === 'menu_main') {
          return { ...btn, text: '🔙 Kembali ke Kategori', callback_data: 'menu_topup' };
        }
        return btn;
      });
    });

    return result;
  }

  /**
   * Legacy Support / Default handler
   */
  async getTopUpMenu(page = 1) {
    // For now, default to Showing Categories
    return this.getTopUpCategoryMenu();
  }

  getPaymentMenu() {
    return MENUS.PAYMENT;
  }

  getBackToHomeMenu() {
    return MENUS.BACK_TO_HOME;
  }

  async getMenuOptions(type) {
    switch (type) {
      case 'main': return this.getMainMenu();
      case 'payment': return this.getPaymentMenu();
      case 'topup': return await this.getTopUpMenu();
      default: return {};
    }
  }
}
