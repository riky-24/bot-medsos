/**
 * MenuRouter
 * Handles all menu-related callback routing
 * Responsibility: Navigate between different menus
 */
import logger from '../../../../shared/services/Logger.js';

export class MenuRouter {
  constructor(deps, config) {
    this.sendPort = deps.sendPort;
    this.menuHandler = deps.menuHandler;
    this.paymentService = deps.paymentService;
    this.sessionService = deps.sessionService; // NEW: for UI tracking
    this.messages = config.messages;
    this.menus = config.menus;

    if (deps.ui) {
      this.ui = deps.ui;
    }
  }

  /**
   * Route menu callbacks
   * @param {String} action - Menu action ('topup', 'payment', 'payment_reopen', 'admin')
   * @param {String} chatId - Telegram chat ID
   * @param {Number} messageId - Message ID for editing
   */
  async route(action, chatId, messageId = null) {
    // 1. Handle Categorized Topup Navigation
    if (action.startsWith('topup_cat_')) {
      // Format: topup_cat_verified OR topup_cat_verified_page_2
      const parts = action.split('_');
      const category = parts[2]; // verified, regular, vouchers
      const page = action.includes('page_') ? parseInt(parts.pop(), 10) : 1;

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
      return { status: 'handled', view: `topup_${category}` };
    }

    // 1.1 Handle Main Topup Entry (Category Selection)
    if (action === 'topup') {
      const menuResult = await this.menuHandler.getTopUpMenu();
      const title = this.messages.TOPUP_MENU_TITLE || "🎮 **PILIH KATEGORI LAYANAN**";

      await this.ui.sendOrEdit(chatId, title, { reply_markup: menuResult });
      return { status: 'handled', view: 'topup_categories' };
    }

    // 2. Standard Switch for others
    switch (action) {

      case 'history':
        return await this.handleHistory(chatId, messageId);

      case 'payment':
      case 'payment_reopen':
        // Payment menu (Checkout Mode)
        return { delegateTo: 'paymentChannel', mode: 'payment', chatId, messageId };

      case 'info_payment':
      case 'guide': // Legacy fallback
        // Payment Info (Info Mode)
        logger.info('[MenuRouter] Delegating to paymentChannel in INFO mode');
        return { delegateTo: 'paymentChannel', mode: 'info', chatId, messageId };

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
        return { status: 'handled', view: 'admin' };

      case 'contact':
        await this.ui.sendOrEdit(chatId, this.messages.CONTACT_INFO, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "💬 Chat WhatsApp", url: "https://wa.me/6281234567890" }],
              [{ text: "🔙 Kembali", callback_data: "menu_main" }]
            ]
          }
        });
        return { status: 'handled', view: 'contact' };

      case 'home':
      case 'main':
      default:
        // NOTE: Don't clearSession here - it deletes lastMsgId needed for bubble tracking
        // Session is cleared on: /start, cancel action, or transaction complete

        // Standard Welcome / Main Menu
        await this.ui.sendOrEdit(chatId, this.messages.WELCOME?.() || "Selamat Datang!", { reply_markup: this.menuHandler.getMainMenu() });
        return { status: 'handled', view: 'main' };
    }
  }



  /**
   * Handle transaction history request
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
        return { toast: this.messages.HISTORY_EMPTY_TOAST || "Belum ada transaksi." };
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
      return { toast: this.messages.HISTORY_REFRESH_SUCCESS };

    } catch (error) {
      logger.error('[MenuRouter] History Error:', error);
      const errMsg = this.messages.ERROR("Gagal memuat riwayat transaksi.");
      await this.ui.sendOrEdit(chatId, errMsg, {});
    }
  }

  /**
   * Navigate back to main menu
   */
  async toMainMenu(chatId) {
    await this.menuHandler.showMainMenu(chatId);
  }

  /**
   * Navigate to top-up menu
   */
  async toTopUpMenu(chatId, messageId = null) {
    await this.route('topup', chatId, messageId);
  }
}
