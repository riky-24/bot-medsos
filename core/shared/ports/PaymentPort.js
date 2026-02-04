/**
 * PaymentPort - Interface for payment gateway operations
 * 
 * This port defines the contract for payment adapters.
 * Any payment gateway (Sakurupiah, Netzme, etc.) must implement these methods.
 */
export class PaymentPort {
  /**
   * Get available payment channels
   * @returns {Promise<Array>} List of payment channels
   */
  async getPaymentChannels() {
    throw new Error('PaymentPort.getPaymentChannels() must be implemented by adapter');
  }

  /**
   * Create a payment invoice
   * @param {Object} orderData - Order details
   * @returns {Promise<Object>} Invoice details with payment URL/QR
   */
  async createInvoice(orderData) {
    throw new Error('PaymentPort.createInvoice() must be implemented by adapter');
  }

  /**
   * Check transaction status by merchant reference
   * @param {String} merchantRef - Merchant reference ID
   * @returns {Promise<Object>} Transaction status details
   */
  async checkTransactionStatus(merchantRef) {
    throw new Error('PaymentPort.checkTransactionStatus() must be implemented by adapter');
  }

  /**
   * Get transaction details by transaction ID
   * @param {String} trxId - Transaction ID from payment gateway
   * @returns {Promise<Object>} Transaction details
   */
  async getTransactionDetails(trxId) {
    throw new Error('PaymentPort.getTransactionDetails() must be implemented by adapter');
  }
}
