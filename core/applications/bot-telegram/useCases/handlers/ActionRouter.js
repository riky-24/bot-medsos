/**
 * ActionRouter
 * Handles action-related callbacks (payment actions, confirmations)
 * Responsibility: Process user actions like "Pay Now", confirmations
 */
import logger from '../../../../shared/services/Logger.js';
import { PERMISSIONS } from '../../security/authz/permissions.js';

export class ActionRouter {
  constructor(deps, config) {
    this.sendPort = deps.sendPort;
    this.paymentService = deps.paymentService;
    this.sessionService = deps.sessionService;
    this.paymentHandler = deps.paymentHandler;
    this.menuHandler = deps.menuHandler;
    this.paymentHandler = deps.paymentHandler;
    this.menuHandler = deps.menuHandler;
    this.messages = config.messages;
    this.authPort = deps.authPort; // Security Port

    // UI Orchestrator
    if (deps.ui) {
      this.ui = deps.ui;
    }
  }

  /**
   * Route action callbacks
   * @param {String} action - Action type (e.g., 'pay_QRIS', 'cancel')
   * @param {String} chatId - Telegram chat ID
   * @param {Number} messageId - Message ID for editing (Optional)
   */
  async route(action, chatId, messageId = null) {
    // Extract channel code from action (e.g., 'pay_QRIS' -> 'QRIS')
    if (action.startsWith('pay_')) {
      const channelCode = action.replace('pay_', '');
      return await this.handlePayNow(chatId, channelCode, messageId);
    }

    if (action.startsWith('check_trx_')) {
      const ref = action.replace('check_trx_', '');
      return await this.handleCheckTransaction(chatId, ref, true, messageId); // Try to edit existing invoice
    }

    if (action.startsWith('refresh_status_')) {
      const ref = action.replace('refresh_status_', '');
      return await this.handleCheckTransaction(chatId, ref, true, messageId); // true = edit existing
    }

    if (action.startsWith('reprint_')) {
      const ref = action.replace('reprint_', '');
      return await this.handleReprint(chatId, ref, true, messageId); // isEdit=true enables refresh behavior
    }

    // Generic Delete Action (Close button)
    if (action === 'delete_msg') {
      await this._sendOrEdit(chatId, messageId, null, { deleteOnly: true });
      return;
    }

    switch (action) {
      case 'cancel':
        await this.handleCancel(chatId, messageId);
        return { toast: "Pesanan dibatalkan." };

      case 'confirm_id':
        return await this.handleConfirmId(chatId, messageId);

      case 'process_payment':
      case 'confirm': // Legacy/Alias
        return await this.handleProcessPayment(chatId, messageId);

      default:
        logger.warn(`[ActionRouter] Unknown action: ${action}`);
        await this._sendOrEdit(chatId, null, this.messages.ERR_ACTION_UNKNOWN);
    }
  }

  /**
   * Handle Reprint Invoice
   */

  async handleReprint(chatId, merchantRef, isEdit = false, messageId = null) {
    try {
      // [REFACTOR] Use PaymentService for logic
      const { result, orderData } = await this.paymentService.reprintTransaction(merchantRef);

      // Determine UI Type based on Data availability (QR String present = QR Invoice)
      // Delegate to PaymentHandler to resend invoice
      const options = { messageId: isEdit ? messageId : null };

      if (result.qr_string) {
        await this.paymentHandler.sendQRInvoice(chatId, result, orderData, options);
      } else {
        await this.paymentHandler.sendPaymentDetails(chatId, result, orderData, options);
      }

      return { toast: "Invoice dicetak ulang." };

    } catch (error) {
      logger.error(`[ActionRouter] Reprint Error: ${error.message}`, error);
      const errMsg = error.message === 'Transaction not found' ? this.messages.ERR_TRX_NOT_FOUND : this.messages.ERR_REPRINT_FAILED;
      await this._sendOrEdit(chatId, null, errMsg);
    }
  }

  /**
   * Handle "Pay Now" action
   * @param {String} chatId
   * @param {String} channelCode - Payment channel code
   * @param {Number} messageId - Message ID for editing
   */
  async handlePayNow(chatId, channelCode, messageId = null) {
    try {
      // SECURITY CHECK: Payment Permission
      if (this.authPort && !await this.authPort.can({ id: chatId }, PERMISSIONS.PAYMENT_CREATE)) {
        await this._sendOrEdit(chatId, null, "❌ Anda tidak memiliki izin untuk melakukan pembayaran.");
        return;
      }

      // Get pending order
      const pendingOrder = await this.sessionService.getPendingOrder(chatId);

      if (!pendingOrder) {
        await this._sendOrEdit(chatId, null, this.messages.ERR_NO_ACTIVE_ORDER);
        return;
      }

      // Calculate final amount with fees

      const { finalAmount, feeAmount, channelInfo, feeType } = await this.paymentService.calculateFinalAmount(
        pendingOrder.price,
        channelCode
      );

      // Create invoice data with NEW field names
      const invoiceData = {
        ...pendingOrder,
        channelCode,
        amount: finalAmount, // Saved as 'amount' in DB
        customerName: chatId,
        // UI Display Data
        basePrice: pendingOrder.price,
        feeAmount,
        feeType: feeType || 'Flat',
        channelName: channelInfo.name,
        finalAmount: finalAmount,
        // NEW FIELD MAPPING after schema consolidation
        playerId: pendingOrder.gamePlayerId,  // Use gamePlayerId from session
        code: pendingOrder.serviceCode,       // Map serviceCode to code for PaymentService
        userId: chatId.toString()             // Telegram chatId for Transaction.userId
      };

      // UPDATE SESSION with final calculations so processPayment can access them
      await this.sessionService.savePendingOrder(chatId, invoiceData);

      // Delegate to payment handler for invoice creation
      // Pass messageId to enable editing instead of new message
      await this.paymentHandler.handleOrderReview(chatId, invoiceData, { messageId });

    } catch (error) {
      logger.error(`[ActionRouter] Pay error: ${error.message}`, error);
      await this._sendOrEdit(chatId, null, this.messages.ERROR(error.message));
    }
  }

  /**
   * Handle cancellation
   */
  async handleCancel(chatId, messageId = null) {
    // 1. Edit bubble FIRST (while lastMsgId still exists)
    const text = this.messages.ORDER_CANCELLED;
    const keyboard = this.menuHandler.getMainMenu();
    await this._sendOrEdit(chatId, null, text, { reply_markup: keyboard.reply_markup || keyboard });

    // 2. Clear session AFTER bubble is updated
    if (this.sessionService) {
      await this.sessionService.clearSession(chatId);
    }
  }

  /**
   * Handle Confirm ID action
   */
  async handleConfirmId(chatId, messageId = null) {
    try {
      const pendingOrder = await this.sessionService.getPendingOrder(chatId);
      if (!pendingOrder) {
        await this._sendOrEdit(chatId, null, this.messages.ERR_SESSION_EXPIRED);
        return;
      }

      // We pass messageId to allow 'handleOrderReview' to edit the confirmation message
      // into the invoice, making it a seamless transition (popup-like effect).
      await this.paymentHandler.handleOrderReview(chatId, pendingOrder, { messageId });

      return { toast: "ID Terkonfirmasi!" };

    } catch (error) {
      logger.error(`[ActionRouter] Confirm ID Error: ${error.message}`, error);
      await this._sendOrEdit(chatId, null, this.messages.ERR_PAYMENT_FAILED);
    }
  }

  /**
   * Handle "Process Payment" action (Final execution)
   */
  async handleProcessPayment(chatId, messageId = null) {
    try {
      const pendingOrder = await this.sessionService.getPendingOrder(chatId);

      if (!pendingOrder || !pendingOrder.serviceCode) { // Check serviceCode (NEW field)
        await this._sendOrEdit(chatId, null, this.messages.ERR_SESSION_EXPIRED);
        return;
      }

      // Execute Payment - map serviceCode to code for backwards compatibility
      const orderData = {
        ...pendingOrder,
        code: pendingOrder.serviceCode,  // Map new field to expected field
        channelCode: pendingOrder.channelCode || pendingOrder.channel || 'QRIS'
      };

      // Pass messageId into options
      await this.paymentHandler.processPayment(chatId, orderData, { messageId });

      // Clear session after successful processing initiation
      await this.sessionService.clearSession(chatId);

      return { toast: "Memproses pembayaran..." };

    } catch (error) {
      logger.error(`[ActionRouter] Process Error: ${error.message}`, error);
      await this._sendOrEdit(chatId, null, this.messages.ERR_PAYMENT_FAILED);
    }
  }

  /**

   * Handle transaction status check
   * @param {String} chatId
   * @param {String} ref - Merchant Ref or Trx ID
   * @param {Boolean} isEdit - Whether to edit existing message
   * @param {Number} messageId - Message ID to edit (required if isEdit=true)
   */
  async handleCheckTransaction(chatId, ref, isEdit = false, messageId = null) {
    try {
      // Show loading via UIPersistenceHelper for consistent 1-bubble experience
      const loadingText = this.messages.LOADING_STATUS;
      await this._sendOrEdit(chatId, messageId, loadingText);

      // Use PaymentService for sync (Logic refactored to Service layer)
      const statusData = await this.paymentService.syncTransaction(ref);

      if (!statusData || !statusData.status) {
        await this._sendOrEdit(chatId, null, this.messages.ERR_TRX_NOT_FOUND);
        return;
      }

      // Delegate View logic to PaymentHandler
      // UIPersistenceHelper will handle the bubble tracking
      await this.paymentHandler.sendTransactionStatus(chatId, statusData, {});

    } catch (e) {
      logger.error(`[ActionRouter] Check Trx Error: ${e.message}`, e);
      await this._sendOrEdit(chatId, null, this.messages.ERR_CHECK_FAILED);
    }
  }

  /**
   * Internal Helper for sendOrEdit
   */
  async _sendOrEdit(chatId, messageId, text, options = {}) {
    if (!this.ui) {
      const { UIPersistenceHelper } = await import('../helpers/UIPersistenceHelper.js');
      this.ui = new UIPersistenceHelper(this.sendPort, this.sessionService);
    }

    if (options.deleteOnly) {
      return await this.ui.deleteSilently(chatId, messageId);
    }

    return await this.ui.sendOrEdit(chatId, text, {
      reply_markup: options.reply_markup || null,
      parse_mode: 'Markdown',
      forceNew: options.forceNew || false
    });
  }
}
