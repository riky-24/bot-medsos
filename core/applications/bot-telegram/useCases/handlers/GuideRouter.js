/**
 * GuideRouter
 * Handles payment guide display
 * Responsibility: Show payment guides with instructions and photos
 */
import logger from '../../../../shared/services/Logger.js';

export class GuideRouter {
  constructor(deps, config) {
    this.sendPort = deps.sendPort;
    this.paymentService = deps.paymentService;
    this.sessionService = deps.sessionService;
    this.messages = config.messages;

    if (deps.ui) {
      this.ui = deps.ui;
    }
  }

  /**
   * Display payment guide for a specific channel
   * @param {String} channelCode - Payment channel code
   * @param {String} chatId - Telegram chat ID
   * @param {Number} messageId - Message ID to delete before showing guide
   */
  async showGuide(channelCode, chatId, messageId, isInfoMode = false) {
    logger.debug(`[GuideRouter] showGuide for ${channelCode}, isInfoMode=${isInfoMode}`);
    try {
      // ... (fetch channel)
      // 1. Efficient Lookup (No more loop through all channels)
      const channel = await this.paymentService.getChannelByCode(channelCode);

      if (!channel) {
        await this.ui.sendOrEdit(chatId, this.messages.ERROR(this.messages.ERR_CHANNEL_NOT_FOUND));
        return;
      }

      // Declare orderData for scope access
      let orderData = null;

      // Build caption
      let caption = this.messages.GUIDE_TITLE(channel.nama || channel.name);
      const feeDisplay = channel.percent === 'Percent' || channel.isPercent
        ? `${channel.biaya || channel.feePercent}%`
        : `Rp ${parseInt(channel.biaya || channel.feeFlat).toLocaleString('id-ID')}`;
      caption += this.messages.GUIDE_FEE_LABEL(feeDisplay);
      caption += this.messages.GUIDE_MIN_LABEL(channel.minimal || channel.minAmount);

      // Calculate fee for pending order if exists AND NOT in Info Mode
      if (!isInfoMode && this.sessionService) {
        const session = await this.sessionService.getPendingOrder(chatId);
        if (session) {
          orderData = { item: session.item, price: session.price };
          try {
            const calc = await this.paymentService.calculateFinalAmount(session.price, channelCode);
            caption += this.messages.GUIDE_TOTAL_LABEL(calc.finalAmount);
          } catch (e) {
            logger.error('[GuideRouter] Fee calculation error:', e);
          }
        }
      }

      caption += this.messages.GUIDE_DIVIDER;
      caption += this.messages.GUIDE_STEPS_LABEL;

      // Use guide or default text
      let guideText = '';
      if (Array.isArray(channel.guideSteps)) {
        guideText = channel.guideSteps.join('\n');
      } else if (channel.guideSteps && typeof channel.guideSteps === 'string') {
        guideText = channel.guideSteps;
      } else if (channel.guide?.steps && Array.isArray(channel.guide.steps)) {
        guideText = channel.guide.steps.join('\n');
      } else {
        guideText = this.messages.GUIDE_DEFAULT_STEP;
      }

      caption += guideText.substring(0, 700);

      // Build keyboard
      const keyboard = { inline_keyboard: [] };

      // Add "Pay Now" button if order exists AND NOT in Info Mode
      if (!isInfoMode && orderData && orderData.price) {
        keyboard.inline_keyboard.push([
          { text: this.messages.BUTTON_PAY_WITH(channel.nama || channel.name), callback_data: `action_pay_${channelCode}` }
        ]);
      }

      // Add back button
      const backCallback = isInfoMode ? 'menu_info_payment' : 'menu_payment';
      keyboard.inline_keyboard.push([
        { text: this.messages.BUTTON_BACK_LIST, callback_data: backCallback }
      ]);

      // Build caption with invisible image link for preview
      const logo = channel.logo;
      // Add invisible zero-width space link for image preview at the top
      if (logo && logo.startsWith('http')) {
        caption = `[\u200c](${logo})` + caption;
      }

      const options = {
        parse_mode: 'Markdown',
        reply_markup: keyboard,
        disable_web_page_preview: false // Ensure preview shows the image
      };

      await this.ui.sendOrEdit(chatId, caption, options);

    } catch (error) {
      logger.error('[GuideRouter] Error:', error);
      await this.ui.sendOrEdit(chatId, this.messages.ERROR(this.messages.ERR_GUIDE_FAILED));
    }
  }



  /**
   * Handle guide navigation (back, next, etc.)
   */
  async handleNavigation(chatId, action) {
    // Future: implement guide pagination if needed
    logger.debug(`[GuideRouter] Navigation: ${action}`);
  }
}
