/**
 * @file MenuRouter.js
 * @description Routes menu navigation callbacks and displays menus to users
 * @responsibility Handle menu navigation, transaction history display, and menu state management
 * 
 * @requires SendPort - Telegram bot messaging interface
 * @requires MenuHandler - Menu keyboard generation
 * @requires PaymentService - Transaction history retrieval
 * @requires SessionService - User session for UI tracking
 * @requires UIPersistenceHelper - Single bubble UI experience
 * @requires Logger - Logging service
 * 
 * @architecture Hexagonal Architecture - Application Layer
 * @pattern Router Pattern - Routes menu actions to appropriate views
 * 
 * @example
 * const menuRouter = new MenuRouter(deps, config);
 * await menuRouter.route('topup', chatId, messageId);
 * // Shows top-up category selection menu
 * 
 * @menu_actions Supported actions:
 * - topup: Show top-up category selection
 * - topup_cat_{CATEGORY}: Show games by category (verified, regular, vouchers)
 * - history: Show transaction history
 * - payment: Show payment channels (checkout mode)
 * - info_payment: Show payment channels (info mode)
 * - admin: Admin panel (future)
 * - contact: Contact information
 * - main/home: Main menu
 * 
 * @related
 * - MenuHandler.js - Menu generation logic
 * - CallbackRouter.js - Routes menu callbacks here
 * - PaymentService.js - Transaction data
 */
import logger from '../../../../shared/services/Logger.js';
import { BaseHandler } from './BaseHandler.js';
import { RouterResponse } from './RouterResponse.js';
import { PARSING } from './HandlerConstants.js';

export class MenuRouter extends BaseHandler {
  /**
   * Constructor for MenuRouter
   * 
   * @param {Object} deps - Dependency injection object
   * @param {Object} deps.menuHandler - Menu generation handler
   * @param {Object} deps.paymentService - Payment business logic service
   * @param {Object} deps.sendPort - Telegram bot messaging interface
   * @param {Object} config - Configuration object
   * @extends BaseHandler
   */
  constructor(deps, config) {
    super(deps, config); // Initialize base dependencies

    // Additional dependencies specific to MenuRouter
    this.menuHandler = deps.menuHandler;
    this.paymentService = deps.paymentService;
    this.menus = config.menus;

    // Validate critical dependencies
    this.validateDependencies({
      menuHandler: this.menuHandler
    });
  }

  /**
   * Route menu callbacks to appropriate displays
   * Handles navigation between main menu, top-up categories, history, etc.
   * 
   * @param {string} action - Menu action (e.g., 'topup', 'history', 'admin')
   * @param {string} chatId - Telegram chat identifier
   * @param {number} [messageId=null] - Message ID for editing
   * @param {string} [senderName='Kak'] - Sender name for personalization
   * @returns {Promise<RouterResponse>} Router response
   */
  async route(action, chatId, messageId = null, senderName = 'Kak') {
    // 1. Handle Categorized Topup Navigation
    if (action.startsWith('topup_cat_')) {
      // Format: topup_cat_verified OR topup_cat_verified_page_2
      const parts = action.split('_');
      const category = parts[2]; // verified, regular, vouchers
      const page = action.includes('page_') ? parseInt(parts.pop(), PARSING.DECIMAL_RADIX) : 1;

      const menuResult = await this.menuHandler.getGroupedTopUpMenu(category, page);

      const titleMap = {
        'verified': "🔥 **GAME TERVERIFIKASI**\n_(Support Cek Nickname)_",
        'regular': "🎮 **DAFTAR GAME LAINNYA**",
        'vouchers': "🎟️ **VOUCHER & DIGITAL WALLET**"
      };

      let title = titleMap[category] || "🎮 **PILIH LAYANAN**";
      if (menuResult.pageInfo && menuResult.pageInfo.total > 1) {
        title += `\n_(Hal ${menuResult.pageInfo.current}/${menuResult.pageInfo.total})_`;
      }

      await this.ui.sendOrEdit(chatId, title, { reply_markup: menuResult });
      return RouterResponse.handled(`topup_${category}`);
    }

    // 1.1 Handle Main Topup Entry (Category Selection)
    if (action === 'topup') {
      const menuResult = await this.menuHandler.getTopUpMenu();
      const title = this.messages.TOPUP_MENU_TITLE || "🎮 **PILIH KATEGORI LAYANAN**";

      await this.ui.sendOrEdit(chatId, title, { reply_markup: menuResult });
      return RouterResponse.handled('topup_categories');
    }

    // 2. Standard Switch for others
    switch (action) {

      case 'history':
        return await this.handleHistory(chatId, messageId);

      case 'payment':
      case 'payment_reopen':
        // Payment menu (Checkout Mode)
        return RouterResponse.delegate('paymentChannel', { mode: 'payment', chatId, messageId });

      case 'info_payment':
      case 'guide': // Legacy fallback
        // Payment Info (Info Mode)
        logger.info('[MenuRouter] Delegating to paymentChannel in INFO mode');
        return RouterResponse.delegate('paymentChannel', { mode: 'info', chatId, messageId });

      case 'admin':
        await this.ui.sendOrEdit(chatId, this.messages.ADMIN_PANEL, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📊 Statistik', callback_data: 'admin_stats' }],
              [{ text: '👥 User List', callback_data: 'admin_users' }],
              [{ text: '⬅️ Kembali', callback_data: 'menu_main' }]
            ]
          }
        });
        return RouterResponse.handled('admin');

      case 'contact':
        await this.ui.sendOrEdit(chatId, this.messages.CONTACT_INFO, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "💬 Chat WhatsApp", url: "https://wa.me/6281234567890" }],
              [{ text: "🔙 Kembali", callback_data: "menu_main" }]
            ]
          }
        });
        return RouterResponse.handled('contact');

      case 'home':
      case 'main':
      default:
        // NOTE: Don't clearSession here - it deletes lastMsgId needed for bubble tracking
        // Session is cleared on: /start, cancel action, or transaction complete

        // Standard Welcome / Main Menu
        await this.ui.sendOrEdit(chatId, this.messages.WELCOME?.(senderName) || "Selamat Datang!", { reply_markup: this.menuHandler.getMainMenu() });
        return RouterResponse.handled('main');
    }
  }



  /**
   * Handle transaction history request
   * Fetches and displays user's recent transactions
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {number} [messageId=null] - Message ID for editing
   * @returns {Promise<RouterResponse>} Toast notification
   */
  async handleHistory(chatId, messageId = null) {
    try {
      if (!this.paymentService) {
        await this.ui.sendOrEdit(chatId, this.messages.ERR_HISTORY_UNAVAILABLE, {});
        return;
      }

      const userId = chatId.toString();
      const transactions = await this.paymentService.getUserTransactionHistory(userId, 5);

      if (!transactions || transactions.length === 0) {
        const text = this.messages.ERR_HISTORY_NOT_FOUND;
        const keyboard = {
          inline_keyboard: [
            [{ text: this.messages.BUTTON_BACK_TO_MENU, callback_data: "menu_main" }]
          ]
        };
        await this.ui.sendOrEdit(chatId, text, { reply_markup: keyboard });
        return RouterResponse.toast(this.messages.HISTORY_EMPTY_TOAST || "Belum ada transaksi.");
      }

      let msg = this.messages.HISTORY_TITLE;
      let unpaidTransactions = [];

      transactions.forEach((trx, index) => {
        const date = new Date(trx.createdAt).toLocaleDateString('id-ID');
        const time = new Date(trx.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        const statusIcon = (trx.status === 'PAID' || trx.status === 'success') ? '✅'
          : (trx.status === 'EXPIRED' || trx.status === 'FAILED') ? '❌'
            : '⏳';

        const amount = parseInt(trx.amount).toLocaleString('id-ID');
        const displayIndex = index + 1;

        msg += `${displayIndex}. ${statusIcon} **${trx.game.toUpperCase()}**\n`;
        msg += `   📦 ${trx.item}\n`;
        msg += `   💵 Rp ${amount} • 📅 ${date} ${time}\n`;

        const playerId = (trx.customerName && trx.customerName !== trx.userId) ? trx.customerName : 'Data Akun';
        msg += `   👤 ID: \`${playerId}\`\n`;
        msg += `   🆔 Ref: \`${trx.merchantRef}\`\n\n`;

        if (trx.status === 'UNPAID' || trx.status === 'pending') {
          unpaidTransactions.push({ ...trx, displayIndex });
        }
      });

      msg += this.messages.HISTORY_FOOTER;

      const keyboard = { inline_keyboard: [] };

      if (unpaidTransactions.length > 0) {
        unpaidTransactions.forEach(trx => {
          keyboard.inline_keyboard.push([
            { text: this.messages.BUTTON_PAY_NOW(trx.displayIndex), callback_data: `action_reprint_${trx.merchantRef}` }
          ]);
        });
      }

      keyboard.inline_keyboard.push(
        [{ text: this.messages.BUTTON_REFRESH, callback_data: "menu_history" }],
        [{ text: this.messages.BUTTON_BACK_TO_MENU, callback_data: "menu_main" }]
      );

      await this.ui.sendOrEdit(chatId, msg, { reply_markup: keyboard });
      return RouterResponse.toast(this.messages.HISTORY_REFRESH_SUCCESS);

    } catch (error) {
      this.logError('History Error', error, { chatId, action: 'menu_history' });
      const errMsg = this.messages.ERROR("Gagal memuat riwayat transaksi.");
      await this.ui.sendOrEdit(chatId, errMsg, {});
    }
  }

  /**
   * Navigate back to main menu
   * Helper method for quick redirection
   * 
   * @param {string} chatId - Telegram chat identifier
   * @returns {Promise<void>}
   */
  async toMainMenu(chatId) {
    await this.menuHandler.showMainMenu(chatId);
  }

  /**
   * Navigate to top-up menu
   * Helper method for quick redirection
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {number} [messageId=null] - Message ID for editing
   * @returns {Promise<void>}
   */
  async toTopUpMenu(chatId, messageId = null) {
    await this.route('topup', chatId, messageId);
  }
}
