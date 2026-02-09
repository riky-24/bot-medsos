/**
 * @file ActionRouter.js
 * @description Handles action-related callbacks for payment processing, confirmations, and transaction management
 * @responsibility Process user actions like "Pay Now", order confirmations, transaction checks, and invoice reprints
 * 
 * @requires SendPort - Telegram bot messaging interface
 * @requires PaymentService - Payment processing and fee calculation
 * @requires SessionService - User session state management  
 * @requires PaymentHandler - Payment UI rendering and invoice generation
 * @requires MenuHandler - Menu generation for fallback navigation
 * @requires AuthPort - Authorization service for permission checks
 * @requires UIPersistenceHelper - Single bubble UI experience (lazy loaded)
 * @requires Logger - Logging service
 * @requires PERMISSIONS - Authorization permission constants
 * 
 * @architecture Hexagonal Architecture - Application Layer
 * @pattern Command Pattern - Each action type maps to a handler method
 * 
 * @example
 * const actionRouter = new ActionRouter(deps, config);
 * await actionRouter.route('pay_QRIS', chatId, messageId);
 * // Calls handlePayNow(chatId, 'QRIS', messageId)
 * 
 * @action_types Supported action types:
 * - pay_{CHANNEL}: Initiate payment with specific channel (e.g., pay_QRIS, pay_DANA)
 * - check_trx_{REF}: Check transaction status by merchant reference
 * - refresh_status_{REF}: Refresh transaction status display
 * - reprint_{REF}: Reprint invoice for existing transaction
 * - cancel: Cancel current order  
 * - confirm_id: Confirm player ID before payment
 * - process_payment: Finalize and process payment
 * - delete_msg: Delete message
 * 
 * @security
 * - Payment permission check via authPort.can(PERMISSIONS.PAYMENT_CREATE)
 * - Input validation for merchant references and amounts
 * - Session state verification before payment processing
 * 
 * @related
 * - PaymentHandler.js - Payment UI and invoice rendering
 * - PaymentService.js - Business logic for payment processing
 * - CallbackRouter.js - Main router that delegates here
 */
import logger from '../../../../shared/services/Logger.js';
import { PERMISSIONS } from '../../security/authz/permissions.js';
import { BaseHandler } from './BaseHandler.js';
import { RouterResponse } from './RouterResponse.js';

export class ActionRouter extends BaseHandler {
  /**
   * Constructor for ActionRouter
   * Handles payment processing, confirmations, and transaction management actions
   * 
   * @param {Object} deps - Dependency injection object
   * @param {Object} deps.paymentService - Payment business logic service
   * @param {Object} deps.paymentHandler - Payment UI handler
   * @param {Object} deps.menuHandler - Menu generation handler
   * @param {Object} deps.authPort - Authorization port untuk permission checks
   * @param {Object} config - Configuration object
   * @extends BaseHandler
   */
  constructor(deps, config) {
    super(deps, config); // Initialize base dependencies

    // Additional dependencies specific to ActionRouter
    this.paymentService = deps.paymentService;
    this.paymentHandler = deps.paymentHandler;
    this.menuHandler = deps.menuHandler;
    this.authPort = deps.authPort; // Security Port
  }

  /**
   * Route action callbacks to appropriate handlers
   * Delegates to specific handlers based on action prefix or type
   * 
   * @param {string} action - Action type (e.g., 'pay_QRIS', 'cancel', 'check_trx_REF123')
   * @param {string} chatId - Telegram chat identifier
   * @param {number} [messageId=null] - Message ID for editing (optional)
   * @returns {Promise<RouterResponse|void>} Router response or void
   * 
   *  @example
   * // Payment channel selection
   * await route('pay_QRIS', '12345', 67890);
   * 
   * // Transaction check
   * await route('check_trx_REF123', '12345', null);
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
      await this.sendOrEdit(chatId, messageId, null, { deleteOnly: true });
      return;
    }

    switch (action) {
      case 'cancel':
        await this.handleCancel(chatId, messageId);
        this.logSuccess('Order Cancelled', { chatId, action: 'cancel' });
        return RouterResponse.toast("Pesanan dibatalkan.");

      case 'confirm_id':
        return await this.handleConfirmId(chatId, messageId);

      case 'process_payment':
      case 'confirm': // Legacy/Alias
        return await this.handleProcessPayment(chatId, messageId);

      default:
        logger.warn(`[ActionRouter] Unknown action: ${action}`);
        await this.sendOrEdit(chatId, null, this.messages.ERR_ACTION_UNKNOWN);
    }
  }

  /**
   * Reprint or refresh payment invoice for existing transaction
   * Retrieves transaction data and regenerates the payment details display
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {string} merchantRef - Merchant reference ID for the transaction
   * @param {boolean} [isEdit=false] - Whether to edit existing message
   * @param {number} [messageId=null] - Message ID to edit (required if isEdit=true)
   * @returns {Promise<RouterResponse>} Toast notification of success
   * @throws {Error} If transaction not found or payment service unavailable
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

      this.logSuccess('Invoice Reprinted', { chatId, merchantRef: ref });
      return RouterResponse.toast("Invoice dicetak ulang.");

    } catch (error) {
      logger.error(`[ActionRouter] Reprint Error: ${error.message}`, error);
      const errMsg = error.message === 'Transaction not found' ? this.messages.ERR_TRX_NOT_FOUND : this.messages.ERR_REPRINT_FAILED;
      await this.sendOrEdit(chatId, null, errMsg);
    }
  }

  /**
   * Handle "Pay Now" action with selected payment channel
   * Calculates final amount with fees and displays order review invoice
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {string} channelCode - Payment channel code (e.g., 'QRIS', 'DANA', 'OVO')
   * @param {number} [messageId=null] - Message ID for editing
   * @returns {Promise<void>}
   * @throws {Error} If pending order not found or payment calculation fails
   * 
   * @security Requires PAYMENT_CREATE permission
   */
  async handlePayNow(chatId, channelCode, messageId = null) {
    try {
      // SECURITY CHECK: Payment Permission
      if (this.authPort && !await this.authPort.can({ id: chatId }, PERMISSIONS.PAYMENT_CREATE)) {
        await this.sendOrEdit(chatId, null, "❌ Anda tidak memiliki izin untuk melakukan pembayaran.");
        return;
      }

      // Get pending order
      const pendingOrder = await this.sessionService.getPendingOrder(chatId);

      if (!pendingOrder) {
        await this.sendOrEdit(chatId, null, this.messages.ERR_NO_ACTIVE_ORDER);
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
      await this.sendOrEdit(chatId, null, this.messages.ERROR(error.message));
    }
  }

  /**
   * Handle order cancellation
   * Clears pending order from session and deletes current message
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {number} [messageId=null] - Message ID to delete
   * @returns {Promise<RouterResponse>} Toast notification of cancellation
   */
  async handleCancel(chatId, messageId = null) {
    // 1. Edit bubble FIRST (while lastMsgId still exists)
    const text = this.messages.ORDER_CANCELLED;
    const keyboard = this.menuHandler.getMainMenu();
    await this.sendOrEdit(chatId, null, text, { reply_markup: keyboard.reply_markup || keyboard });

    // 2. Clear session AFTER bubble is updated
    if (this.sessionService) {
      await this.sessionService.clearSession(chatId);
    }
  }

  /**
   * Handle player ID confirmation before payment
   * Validates pending order exists and triggers order review display
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {number} [messageId=null] - Message ID for editing
   * @returns {Promise<RouterResponse>} Toast notification of confirmation
   * @throws {Error} If no pending order found in session
   */
  async handleConfirmId(chatId, messageId = null) {
    try {
      const pendingOrder = await this.sessionService.getPendingOrder(chatId);
      if (!pendingOrder) {
        await this.sendOrEdit(chatId, null, this.messages.ERR_SESSION_EXPIRED);
        return;
      }

      // We pass messageId to allow 'handleOrderReview' to edit the confirmation message
      // into the invoice, making it a seamless transition (popup-like effect).
      await this.paymentHandler.handleOrderReview(chatId, pendingOrder, { messageId });

      this.logSuccess('Player ID Confirmed', {
        chatId,
        game: pendingOrder.game,
        playerId: pendingOrder.gamePlayerId
      });
      return RouterResponse.toast("ID Terkonfirmasi!");

    } catch (error) {
      logger.error(`[ActionRouter] Confirm ID Error: ${error.message}`, error);
      await this.sendOrEdit(chatId, null, this.messages.ERR_PAYMENT_FAILED);
    }
  }

  /**
   * Handle "Process Payment" action (Final execution)
   * Executes payment processing and clears session after successful initiation
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {number} [messageId=null] - Message ID for editing
   * @returns {Promise<RouterResponse>} Toast notification of processing
   * @throws {Error} If session expired or payment processing fails
   */
  async handleProcessPayment(chatId, messageId = null) {
    try {
      const pendingOrder = await this.sessionService.getPendingOrder(chatId);

      if (!pendingOrder || !pendingOrder.serviceCode) { // Check serviceCode (NEW field)
        await this.sendOrEdit(chatId, null, this.messages.ERR_SESSION_EXPIRED);
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

      this.logSuccess('Payment Initiated', {
        chatId,
        game: pendingOrder.game,
        amount: pendingOrder.finalAmount,
        channel: pendingOrder.paymentChannel
      });
      return RouterResponse.toast("Memproses pembayaran...");

    } catch (error) {
      logger.error(`[ActionRouter] Process Error: ${error.message}`, error);
      await this.sendOrEdit(chatId, null, this.messages.ERR_PAYMENT_FAILED);
    }
  }

  /**
   * Handle transaction status check and display
   * Fetches transaction status from payment service and shows updated information
   * 
   * @param {string} chatId - Telegram chat identifier
   * @param {string} ref - Merchant reference ID or transaction ID
   * @param {boolean} [isEdit=false] - Whether to edit existing message
   * @param {number} [messageId=null] - Message ID to edit (required if isEdit=true)
   * @returns {Promise<void>}
   * @throws {Error} If transaction not found or payment service unavailable
   */
  async handleCheckTransaction(chatId, ref, isEdit = false, messageId = null) {
    try {
      // Show loading via UIPersistenceHelper for consistent 1-bubble experience
      const loadingText = this.messages.LOADING_STATUS;
      await this.sendOrEdit(chatId, messageId, loadingText);

      // Use PaymentService for sync (Logic refactored to Service layer)
      const statusData = await this.paymentService.syncTransaction(ref);

      if (!statusData || !statusData.status) {
        await this.sendOrEdit(chatId, null, this.messages.ERR_TRX_NOT_FOUND);
        return;
      }

      // Delegate View logic to PaymentHandler
      // UIPersistenceHelper will handle the bubble tracking
      await this.paymentHandler.sendTransactionStatus(chatId, statusData, {});

    } catch (e) {
      logger.error(`[ActionRouter] Check Trx Error: ${e.message}`, e);
      await this.sendOrEdit(chatId, this.messages.ERR_CHECK_FAILED);
    }
  }
}
