/**
 * @file GuideRouter.js
 * @description Displays payment channel guides with instructions and fee information
 * @responsibility Show detailed payment guides for selected channels in checkout or info mode
 * 
 * @requires SendPort - Telegram bot messaging interface
 * @requires PaymentService - Channel data and fee calculation
 * @requires SessionService - User session for pending order data
 * @requires UIPersistenceHelper - Single bubble UI experience
 * @requires Logger - Logging service
 * 
 * @architecture Hexagonal Architecture - Application Layer
 * @pattern View Pattern - Renders payment guide views
 * 
 * @example
 * const guideRouter = new GuideRouter(deps, config);
 * await guideRouter.showGuide('QRIS', chatId, messageId, false);
 * // Shows QRIS payment guide in checkout mode
 * 
 * @modes
 * - Checkout Mode (isInfoMode=false): Shows guide with "Pay Now" button for active orders
 * - Info Mode (isInfoMode=true): Shows guide for informational purposes only
 * 
 * @related
 * - CallbackRouter.js - Routes guide/info callbacks here
 * - PaymentService.js - Provides channel data
 */
import logger from '../../../../shared/services/Logger.js';
import { BaseHandler } from './BaseHandler.js';

export class GuideRouter extends BaseHandler {
  /**
   * Constructor for GuideRouter
   * 
   * @param {Object} deps - Dependency injection object
   * @param {Object} deps.paymentService - Payment business logic service
   * @param {Object} deps.sendPort - Telegram bot messaging interface
   * @param {Object} config - Configuration object with messages
   * @extends BaseHandler
   */
  constructor(deps, config) {
    super(deps, config); // Initialize base dependencies

    // Additional dependencies specific to GuideRouter
    this.paymentService = deps.paymentService;
  }

  /**
   * Display payment guide for a specific channel
   * Renders step-by-step instructions, fees, and minimum amount
   * 
   * @param {string} channelCode - Payment channel code (e.g., 'QRIS', 'DANA')
   * @param {string} chatId - Telegram chat identifier
   * @param {number} messageId - Message ID to delete before showing guide
   * @param {boolean} [isInfoMode=false] - If true, shows guide in info mode (no "Pay Now" button)
   * @returns {Promise<void>}
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
   * Placeholder for future guide pagination features
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {string} action - Navigation action
   * @returns {Promise<void>}
   */
  async handleNavigation(chatId, action) {
    // Future: implement guide pagination if needed
    logger.debug(`[GuideRouter] Navigation: ${action}`);
  }
}
