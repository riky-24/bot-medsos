/**
 * PaymentChannelHandler
 * Handles payment channel selection and display
 * Responsibility: Show available payment channels, format channel info
 */
import logger from '../../../../shared/services/Logger.js';

export class PaymentChannelHandler {
  constructor(deps, config) {
    this.sendPort = deps.sendPort;
    this.paymentService = deps.paymentService;
    this.sessionService = deps.sessionService; // NEW: for UI tracking
    this.messages = config.messages;

    if (deps.ui) {
      this.ui = deps.ui;
    }
  }

  /**
   * Display payment channels as interactive buttons
   * @param {String} chatId - Telegram chat ID
   * @param {Number} messageId - Message ID for editing
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
   * Group channels by method type
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
   * Handle channel selection
   * Returns guide callback for selected channel
   */
  async handleSelection(chatId, channelCode) {
    return { delegateTo: 'guide', channelCode, chatId };
  }
}
