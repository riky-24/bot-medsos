/**
 * @file PaymentChannelHandler.js
 * @description Displays available payment channels grouped by method type
 * @responsibility Show payment channel selection UI, group channels by method (E-Wallet, VA, etc.)
 * 
 * @requires SendPort - Telegram bot messaging interface
 * @requires PaymentService - Channel data retrieval
 * @requires SessionService - User session for UI tracking
 * @requires UIPersistenceHelper - Single bubble UI experience
 * @requires Logger - Logging service
 * 
 * @architecture Hexagonal Architecture - Application Layer
 * @pattern Presenter Pattern - Formats and displays channel data
 * 
 * @example
 * const handler = new PaymentChannelHandler(deps, config);
 * await handler.displayChannels(chatId, messageId, 'payment');
 * // Shows payment channels in checkout mode
 * 
 * @modes
 * - payment: Checkout mode - shows guide buttons for payment flow
 * - info: Info mode - shows guide buttons for informational purposes
 * 
 * @channel_grouping Channels grouped by 'metode' field:
 * - E-Wallet (QRIS, DANA, OVO, etc.)
 * - Virtual Account (BCA, BNI, Mandiri, etc.)
 * - Lainnya (Other methods)
 * 
 * @related
 * - CallbackRouter.js - Routes to this handler
 * - GuideRouter.js - Displays guides after channel selection
 * - PaymentService.js - Provides channel data
 */
import logger from '../../../../shared/services/Logger.js';
import { BaseHandler } from './BaseHandler.js';

export class PaymentChannelHandler extends BaseHandler {
  /**
   * Constructor for PaymentChannelHandler
   * 
   * @param {Object} deps - Dependency injection object
   * @param {Object} deps.paymentService - Payment business logic service
   * @param {Object} deps.sendPort - Telegram bot messaging interface
   * @param {Object} config - Configuration object
   * @extends BaseHandler
   */
  constructor(deps, config) {
    super(deps, config); // Initialize base dependencies

    // Additional dependencies specific to PaymentChannelHandler
    this.paymentService = deps.paymentService;
  }

  /**
   * Display payment channels as interactive buttons
   * Fetches channels from PaymentService and renders them
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {number} [messageId=null] - Message ID for editing
   * @param {string} [mode='payment'] - Display mode ('payment' or 'info')
   * @returns {Promise<void>}
   */
  async displayChannels(chatId, messageId = null, mode = 'payment') {
    logger.info(`[PaymentChannelHandler] Displaying channels for ${chatId}, mode=${mode}`);
    const title = this.messages.PAYMENT_METHOD_SELECTION;
    let keyboard = { inline_keyboard: [] };

    try {
      logger.debug("[PaymentChannelHandler] Fetching channels...");
      const channels = await this.paymentService.getPaymentChannels();

      if (Array.isArray(channels) && channels.length > 0) {
        // Group channels by method (E-Wallet, Virtual Account, etc.)
        const grouped = this.groupChannelsByMethod(channels);

        // Create buttons for each group
        for (const [method, methodChannels] of Object.entries(grouped)) {
          // REMOVED Header Button as per user request (should be text, not button)

          // Channel buttons (2 per row)
          let row = [];
          for (const channel of methodChannels) {
            const feeDisplay = channel.percent === 'Percent'
              ? `${channel.biaya}%`
              : `Rp ${parseInt(channel.biaya).toLocaleString('id-ID')}`;
            const label = `${channel.nama} ${this.messages.CHANNEL_METHOD_LABEL(feeDisplay)}`;

            const prefix = mode === 'info' ? 'info_' : 'guide_';
            row.push({ text: label, callback_data: `${prefix}${channel.kode}` });

            if (row.length === 2) {
              keyboard.inline_keyboard.push(row);
              row = [];
            }
          }
          if (row.length > 0) {
            keyboard.inline_keyboard.push(row);
          }
        }
      } else {
        // No channels available
        keyboard.inline_keyboard.push([
          { text: this.messages.CHANNEL_EMPTY, callback_data: 'noop' }
        ]);
      }
    } catch (error) {
      logger.error(`[PaymentChannelHandler] Error fetching channels: ${error.message}`);
      // Fallback: Show simple message to user
      const errorMessage = this.messages.ERR_CHANNEL_LOAD_FAILED;

      // If we failed to get channels, we can't show buttons.
      // Just show a text alert.
      try {
        await this.ui.sendOrEdit(chatId, errorMessage);
        return; // Exit, don't try to edit previous message
      } catch (e) { }

      keyboard.inline_keyboard.push([
        { text: this.messages.CHANNEL_LOAD_ERROR_BUTTON, callback_data: 'noop' }
      ]);
    }

    // Add back button
    keyboard.inline_keyboard.push([
      { text: this.messages.BUTTON_BACK_MAIN, callback_data: 'menu_main' }
    ]);

    const options = {
      parse_mode: 'Markdown',
      reply_markup: keyboard // Pass Object!
    };

    await this.ui.sendOrEdit(chatId, title, options);
  }



  /**
   * Group channels by method type (e.g. E-Wallet, Virtual Account)
   * Helper method for organizing channel buttons
   * 
   * @param {Array<Object>} channels - List of payment channels
   * @returns {Object} Channels grouped by method key
   * @private
   */
  groupChannelsByMethod(channels) {
    const groups = {};

    for (const channel of channels) {
      const method = channel.metode || 'Lainnya';
      if (!groups[method]) {
        groups[method] = [];
      }
      groups[method].push(channel);
    }

    return groups;
  }

  /**
   * Handle channel selection return value
   * Returns guide delegation object
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {string} channelCode - Selected channel code
   * @returns {Promise<Object>} Delegation object for guide display
   */
  async handleSelection(chatId, channelCode) {
    return { delegateTo: 'guide', channelCode, chatId };
  }
}
