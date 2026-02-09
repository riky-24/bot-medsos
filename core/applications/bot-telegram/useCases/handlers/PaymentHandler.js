/**
 * @file PaymentHandler.js
 * @description Handles payment flow, invoice generation, and transaction status display
 * @responsibility Process payments, generate QR/payment detail invoices, display transaction status
 * 
 * @requires PaymentService - Payment business logic and invoice creation
 * @requires SendPort - Telegram bot messaging interface
 * @requires SessionService - User session state management
 * @requires GameService - Game data for invoice display
 * @requires UIPersistenceHelper - Single bubble UI experience
 * @requires Logger - Logging service
 * @requires MENUS - Menu configurations for action buttons
 * @requires PRICING - Pricing constants
 * @requires QR_CODE - QR code API configuration
 * 
 * @architecture Hexagonal Architecture - Application Layer
 * @pattern Service Pattern - Orchestrates payment operations
 * 
 * @example
 * const handler = new PaymentHandler(paymentService, sendPort, sessionService, config, gameService, ui);
 * await handler.processPayment(chatId, orderData, { messageId });
 * // Processes payment and shows invoice
 * 
 * @payment_flow
 * 1. handleOrderReview: Show order summary with confirmation
 * 2. processPayment: Create invoice via PaymentService
 * 3. sendQRInvoice: Display QR code for QRIS/E-Wallet
 * 4. sendPaymentDetails: Display payment code/link for VA/other
 * 5. sendTransactionStatus: Show transaction status updates
 * 
 * @invoice_types
 * - QR Invoice: For QRIS, DANA, OVO (displays QR code image)
 * - Payment Details: For Virtual Account, Direct Link (displays payment code/link)
 * - Transaction Status: Status check view with refresh button
 * 
 * @related
 * - ActionRouter.js - Calls payment processing methods
 * - PaymentService.js - Business logic implementation
 * - UIPersistenceHelper.js - Single bubble UI management
 */
import { MENUS } from '../../config/menus.js';
import { PRICING, QR_CODE } from '../../../../shared/config/constants.js';
import logger from '../../../../shared/services/Logger.js';
import { TIMEOUTS } from './HandlerConstants.js';

export class PaymentHandler {
  /**
   * Constructor for PaymentHandler
   * 
   * @param {Object} paymentService - Service for payment logic and invoice creation
   * @param {Object} sendPort - Telegram bot messaging interface
   * @param {Object} [sessionService=null] - Session management service
   * @param {Object} [config=null] - Configuration object
   * @param {Object} [gameService=null] - Game data service
   * @param {Object} [ui=null] - Pre-initialized UI helper
   */
  constructor(paymentService, sendPort, sessionService = null, config = null, gameService = null, ui = null) {
    this.paymentService = paymentService;
    this.sendPort = sendPort;
    this.sessionService = sessionService;
    this.messages = config?.messages || {};
    this.gameService = gameService;
    this.ui = ui;
  }

  /**
   * Display order review invoice with confirmation buttons
   * Shows detailed breakdown of the order before final processing
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {Object} orderData - Order details (game, item, price, etc.)
   * @param {Object} [options={}] - Additional options
   * @param {number} [options.messageId] - Message ID for editing
   * @returns {Promise<void>}
   */
  async handleOrderReview(chatId, orderData, options = {}) {
    const messageId = options.messageId || null;
    const { game, userId, zoneId, item, price: inputPrice } = orderData;
    const price = inputPrice || PRICING.ML_100_DIAMOND;
    const displayId = orderData.playerId || userId;

    const games = await this.gameService.getAvailableGames();
    const gameInfo = games.find(g => g.code === game) || {};
    const isVerified = !!gameInfo.validationCode;

    const invoiceMsg = orderData.channelCode
      ? this.messages.PAYMENT_FEE_BREAKDOWN(
        item,
        orderData.basePrice || price,
        orderData.channelName || orderData.channelCode,
        orderData.feeType || 'Biaya Layanan',
        orderData.feeAmount || 0,
        orderData.amount || price,
        orderData.nickname,
        isVerified
      )
      : this.messages.ORDER_INVOICE(gameInfo.name || game, displayId, zoneId, item, price, orderData.nickname, isVerified);

    const keyboard = orderData.channelCode ? MENUS.ORDER_PROCESS : MENUS.ORDER_CONFIRMATION;

    await this.ui.sendOrEdit(chatId, invoiceMsg, { reply_markup: keyboard.reply_markup || keyboard });
  }

  /**
   * Process payment and send invoice
   * Creates invoice via PaymentService and dispatches to appropriate display method (QR or Details)
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {Object} [orderData=null] - Order details
   * @param {Object} [options={}] - Additional options
   * @returns {Promise<void>}
   */
  async processPayment(chatId, orderData = null, options = {}) {
    if (!this.paymentService) {
      logger.error('[PaymentHandler] PaymentService not initialized');
      await this.ui.sendOrEdit(chatId, this.messages.PAYMENT_ERROR);
      return;
    }

    const order = orderData;
    if (!order) {
      logger.warn('[PaymentHandler] Attempted payment without valid order data (Session Expired)');
      await this.ui.sendOrEdit(chatId, this.messages.ERR_SESSION_EXPIRED || '⚠️ Sesi kadaluarsa.');
      return;
    }

    await this.ui.sendOrEdit(chatId, this.messages.PAYMENT_PROCESSING);

    try {
      const result = await this.paymentService.createInvoice(order);

      if (result.success) {
        const isQRChannel = this.paymentService.isQRChannel(order.channelCode);

        if (isQRChannel && result.qr_string) {
          await this.sendQRInvoice(chatId, result, order);
        } else {
          await this.sendPaymentDetails(chatId, result, order);
        }
      } else {
        await this.ui.sendOrEdit(chatId, this.messages.PAYMENT_ERROR);
      }
    } catch (error) {
      logger.error(`[PaymentHandler] Payment processing error: ${error.message}`, error);
      await this.ui.sendOrEdit(chatId, this.messages.PAYMENT_ERROR);
    }
  }

  /**
   * Send QR code invoice with payment details
   * Renders QR code image with caption and action buttons
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {Object} result - Payment creation result
   * @param {Object} orderData - Order details
   * @param {Object} [options={}] - Additional options
   * @returns {Promise<void>}
   */
  async sendQRInvoice(chatId, result, orderData, options = {}) {
    // Note: this.ui is injected via constructor

    const qrImageUrl = `${QR_CODE.API_URL}${encodeURIComponent(result.qr_string)}&size=${QR_CODE.SIZE}`;
    const caption = this.messages.PAYMENT_INVOICE(orderData.item, orderData.amount, result.expiry_date, result.payment_url);

    try {
      const keyboard = {
        inline_keyboard: [
          [{ text: "🔄 Cek Status Transaksi", callback_data: `action_check_trx_${result.trx_id || orderData.merchantRef}` }],
          [{ text: "❓ Cara Bayar", callback_data: `info_${orderData.channelCode || 'guide'}` }],
          [{ text: "🔙 Kembali ke Riwayat", callback_data: "menu_history" }]
        ]
      };

      const photoResponse = await this.ui.sendPhoto(chatId, qrImageUrl, {
        caption: caption,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      });

      if (photoResponse?.result?.message_id) {
        if (result.merchantRef) await this.paymentService.updateTransactionMessageId(result.merchantRef, photoResponse.result.message_id);
      }
    } catch (error) {
      logger.error(`[PaymentHandler] Failed to send photo, fallback to text: ${error.message}`);
      await this.sendPaymentLinkFallback(chatId, result);
    }
  }

  /**
   * Send payment link as text (fallback)
   * Used when QR image generation fails or as alternative display
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {Object} result - Payment creation result
   * @returns {Promise<void>}
   */
  async sendPaymentLinkFallback(chatId, result) {
    const payMsg = this.messages.PAYMENT_INVOICE_FALLBACK(result.payment_url, result.qr_string || '-');
    await this.ui.sendOrEdit(chatId, payMsg);

    if (result.merchantRef && this.sessionService) {
      const lastId = await this.sessionService.getLastMessageId(chatId);
      if (lastId) await this.paymentService.updateTransactionMessageId(result.merchantRef, lastId);
    }
  }

  /**
   * Send payment details for non-QR methods (VA, Retail, etc.)
   * Displays payment code (VA number) or payment URL
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {Object} result - Payment creation result
   * @param {Object} orderData - Order details
   * @param {Object} [options={}] - Additional options
   * @returns {Promise<void>}
   */
  async sendPaymentDetails(chatId, result, orderData, options = {}) {
    const trxId = result.trx_id || orderData.merchantRef || '-';
    const trxDate = orderData.createdAt ? new Date(orderData.createdAt) : new Date();
    const expiryDate = result.expiry_date ? new Date(result.expiry_date) : new Date(trxDate.getTime() + TIMEOUTS.PAYMENT_EXPIRY_MS);

    const statusMap = { 'PENDING': this.messages.STATUS_WAITING, 'PAID': this.messages.STATUS_SUCCESS, 'FAILED': this.messages.STATUS_FAILED, 'EXPIRED': this.messages.STATUS_EXPIRED, 'PROCESSING': '⚙️ DIPROSES' };
    const statusText = statusMap[(result.status || 'PENDING').toUpperCase()] || result.status;

    let message = this.messages.PAYMENT_DETAILS_HEADER;
    message += this.messages.PAYMENT_DETAILS_GAME(orderData.game);
    message += this.messages.PAYMENT_DETAILS_ITEM(orderData.item);
    message += this.messages.PAYMENT_DETAILS_PLAYER(orderData.playerId || orderData.userId, orderData.zoneId, orderData.nickname);
    message += this.messages.PAYMENT_DETAILS_METHOD(orderData.channelName || orderData.channelCode || 'Online Payment');
    message += this.messages.PAYMENT_DETAILS_AMOUNT(orderData.amount);
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    const payCodeStr = result.payment_code ? String(result.payment_code) : '';
    const isUrl = payCodeStr && (payCodeStr.startsWith('http') || payCodeStr.includes('://'));

    if (payCodeStr) {
      if (isUrl) { message += this.messages.PAYMENT_LINK_LABEL + this.messages.PAYMENT_LINK_HINT(payCodeStr); }
      else { message += this.messages.PAYMENT_CODE_LABEL + this.messages.PAYMENT_CODE_HINT(payCodeStr); }
    } else if (result.payment_url) {
      message += this.messages.PAYMENT_LINK_LABEL + this.messages.PAYMENT_LINK_HINT(result.payment_url);
    }

    message += this.messages.PAYMENT_DETAILS_FOOTER(statusText, this._formatDate(trxDate), this._formatDate(expiryDate), trxId);

    const keyboard = { inline_keyboard: [[], [{ text: this.messages.BUTTON_CHECK_STATUS, callback_data: `action_check_trx_${trxId}` }], [{ text: this.messages.BUTTON_HOW_TO_PAY, callback_data: `info_${orderData.channelCode || 'guide'}` }, { text: this.messages.BUTTON_BACK_HISTORY, callback_data: "menu_history" }]] };
    if (result.payment_url || (isUrl ? result.payment_code : null)) {
      keyboard.inline_keyboard[0].push({ text: this.messages.BUTTON_PAY_NOW(""), url: result.payment_url || result.payment_code });
    }

    const finalResponse = await this.ui.sendOrEdit(chatId, message, { reply_markup: keyboard });

    if (finalResponse?.result?.message_id && orderData.merchantRef) {
      await this.paymentService.updateTransactionMessageId(orderData.merchantRef, finalResponse.result.message_id);
    }
  }

  /**
   * Send Transaction Status View
   * Displays current status of transaction with refresh button
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {Object} statusData - Transaction status object
   * @param {Object} [options={}] - Additional options
   * @returns {Promise<void>}
   */
  async sendTransactionStatus(chatId, statusData, options = {}) {
    const statusMap = { 'UNPAID': this.messages.STATUS_WAITING, 'PAID': this.messages.STATUS_SUCCESS, 'FAILED': this.messages.STATUS_FAILED, 'EXPIRED': this.messages.STATUS_EXPIRED };
    const statusText = statusMap[statusData.status] || statusData.status;
    const ref = statusData.merchantRef || statusData.trxId || '-';

    let msg = this.messages.STATUS_TITLE;
    msg += this.messages.STATUS_UPDATE_TIME(new Date().toLocaleTimeString('id-ID'));
    msg += this.messages.STATUS_REF_LABEL(ref);
    msg += this.messages.STATUS_LABEL(statusText);
    if (statusData.status === 'PAID') msg += this.messages.STATUS_PAID_DESC;
    else if (statusData.status === 'UNPAID') msg += this.messages.STATUS_UNPAID_DESC;
    msg += `\n━━━━━━━━━━━━━━━━━━━━\n`;

    const keyboard = { inline_keyboard: [[{ text: this.messages.BUTTON_REFRESH, callback_data: `action_refresh_status_${ref}` }, { text: this.messages.BUTTON_CLOSE, callback_data: `delete_msg` }], [{ text: this.messages.BUTTON_BACK_HISTORY, callback_data: "menu_history" }]] };

    await this.ui.sendOrEdit(chatId, msg, { reply_markup: keyboard });
  }

  /**
   * Helper methods
   */

  _formatDate(dateObj) {
    if (!dateObj) return '-';
    return dateObj.toLocaleDateString('id-ID') + ', ' + dateObj.toLocaleTimeString('id-ID').replace(/:/g, '.');
  }
}
