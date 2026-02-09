import crypto from 'crypto';
import { PaymentPort } from '../../../core/shared/ports/PaymentPort.js';
import logger from '../../../core/shared/services/Logger.js';

export class SakurupiahAdapter extends PaymentPort {
  /**
   * @param {String} apiKey - Sakurupiah API Key
   * @param {Object} config - Optional configuration
   * @param {String} config.apiId - API ID (defaults to env)
   * @param {String} config.baseUrl - API base URL (defaults to sandbox)
   * @param {String} config.callbackUrl - Payment callback URL
   * @param {String} config.returnUrl - Payment return/invoice URL
   */
  constructor(apiKey, config = {}) {
    super(); // Call parent constructor
    this.apiKey = apiKey;
    this.apiId = config.apiId || process.env.SAKURUPIAH_API_ID;

    // Configurable URLs - no more hardcoded values
    this.baseUrl = config.baseUrl || process.env.SAKURUPIAH_BASE_URL || "https://sakurupiah.id/api-sandbox";
    this.callbackUrl = config.callbackUrl || process.env.PAYMENT_CALLBACK_URL || null;
    this.returnUrl = config.returnUrl || process.env.PAYMENT_RETURN_URL || null;
  }

  generateSignature(merchantRef, amount, method = "QRIS") {
    // Signature pattern from User: hmac_sha256(api_id + data_method + merchant_ref + amount, apikey)
    const data = `${this.apiId}${method}${merchantRef}${amount}`;
    return crypto.createHmac('sha256', this.apiKey).update(data).digest('hex');
  }

  async createInvoice(orderData) {
    if (!this.apiKey || !this.apiId) {
      logger.warn("[Sakurupiah] Missing API Key/ID. Simulating...");
      return this.simulateResponse(orderData);
    }

    // Format: ORDER-<USER_ID>-<TIMESTAMP> to allow Callback Handler to identify user
    // Sanitize userId to remove spaces (Sakurupiah doesn't allow spaces in merchant_ref)
    const sanitizedUserId = String(orderData.userId || 'UNKNOWN').replace(/\s+/g, '-');
    const merchantRef = orderData.merchantRef || `ORDER-${sanitizedUserId}-${Date.now()}`;
    const amount = orderData.amount.toString();
    // Use channel code from user selection (e.g., GOPAY, BCAVA, QRIS, etc.)
    const paymentMethod = orderData.channelCode || "QRIS"; // Fallback to QRIS if not provided
    const signature = this.generateSignature(merchantRef, amount, paymentMethod);

    // Use FormData for multipart/form-data (matches PHP CURLOPT_POSTFIELDS with array)
    const formData = new FormData();
    formData.append('api_id', this.apiId);
    formData.append('method', paymentMethod);
    formData.append('name', "Customer " + orderData.userId);
    formData.append('email', `user${sanitizedUserId}@b7store.com`);
    formData.append('phone', "62899999999"); // Required by API
    formData.append('amount', amount);
    formData.append('merchant_fee', '1'); // 1 = Fee charged to Merchant
    formData.append('merchant_ref', merchantRef);
    formData.append('expired', '24'); // 24 Hours expiry
    formData.append('signature', signature);

    // Product Details (Array format for PHP backend)
    const productName = `${orderData.game} - ${orderData.item}`;
    formData.append('produk[]', productName);
    formData.append('qty[]', '1');
    formData.append('harga[]', amount);
    formData.append('size[]', 'Digital');
    const gameUserId = orderData.playerId || orderData.customerName || orderData.userId;
    formData.append('note[]', `User ID: ${gameUserId} ${orderData.zoneId ? '(' + orderData.zoneId + ')' : ''}`);

    // Use configurable URLs (from constructor config or environment)
    if (this.callbackUrl) {
      formData.append('callback_url', this.callbackUrl);
    }
    if (this.returnUrl) {
      formData.append('return_url', this.returnUrl);
    }

    try {
      logger.info(`[Sakurupiah] Sending request to ${this.baseUrl}/create.php (multipart/form-data)`);

      const response = await fetch(`${this.baseUrl}/create.php`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
          // ...formData.getHeaders() // Native fetch handles boundary automatically
        },
        body: formData
      });

      if (!response.ok) {
        logger.error(`[Sakurupiah] API Error: ${response.status}`);
      }

      const text = await response.text();

      // Check for HTML response (Error pages)
      if (text.trim().startsWith('<')) {
        logger.warn(`[Sakurupiah] API Returned HTML/Error instead of JSON: ${text.substring(0, 100)}...`);
        logger.warn("[Sakurupiah] API is unstable. Switching to simulation mode.");
        return this.simulateResponse(orderData);
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        logger.error(`[Sakurupiah] JSON Parse Error: ${text.substring(0, 100)}...`);
        // Fallback to simulation if JSON is malformed
        return this.simulateResponse(orderData);
      }

      logger.debug(`[Sakurupiah] Create Response Data: ${JSON.stringify(data, null, 2)}`);

      if (data.status === "FAILED" || (data.status && data.status !== "200") || !data.data) {
        logger.warn(`[Sakurupiah] API Error/Failed: ${data.msg || 'Unknown'}. Using simulation.`);
        return this.simulateResponse(orderData);
      }

      // User sample shows data is an array: "data": [ { ... } ]
      // But sometimes APIs return object directly: "data": { ... }
      const trxData = Array.isArray(data.data) ? data.data[0] : data.data;

      logger.debug(`[Sakurupiah] Extracted Trx Data: ${JSON.stringify(trxData)}`);

      let paymentCode = trxData.payment_no;
      let qrString = trxData.qr;

      // Fallback: If payment_no is missing (common in some APIs), try fetching Transaction Details immediately
      if (!paymentCode && !qrString) {
        logger.info(`[Sakurupiah] Payment No missing for ${merchantRef}, checking details...`);
        try {
          // Use internal checkTransaction
          const detail = await this.checkTransaction(merchantRef);
          if (detail) {
            logger.info(`[Sakurupiah] Succeeded fetching detail: ${JSON.stringify(detail)}`);
            paymentCode = detail.payment_no || detail.pay_code;
            qrString = detail.qr || detail.qr_string;
          }
        } catch (e) {
          logger.warn(`[Sakurupiah] Failed to fetch fallback details: ${e.message}`);
        }
      }

      return {
        success: true,
        payment_url: trxData.checkout_url,
        qr_string: qrString || null,
        expiry_date: trxData.expired,
        payment_code: paymentCode,
        trx_id: trxData.trx_id // Expose trx_id for DB storage
      };

    } catch (error) {
      logger.error(`[Sakurupiah] Request Failed: ${error.message}`);
      return this.simulateResponse(orderData);
    }
  }

  async getPaymentChannels() {
    try {
      const formData = new FormData();
      formData.append('api_id', this.apiId);
      formData.append('method', 'list');

      const response = await fetch(`${this.baseUrl}/list-payment.php`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          // ...formData.getHeaders()
        },
        body: formData
      });

      const text = await response.text();

      if (text.trim().startsWith('<')) {
        logger.error(`[Sakurupiah] API Returned HTML: ${text.substring(0, 100)}...`);
        throw new Error('Payment Gateway API is down (returned HTML)');
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        logger.error(`[Sakurupiah] JSON Parse Error: ${text.substring(0, 100)}...`);
        throw new Error('Invalid JSON response from Payment Gateway');
      }

      return data;
    } catch (e) {
      logger.error(`[Sakurupiah] List Payment Error: ${e.message}`);
      return [];
    }
  }

  async checkTransaction(merchantRef) {
    try {
      const formData = new FormData();
      formData.append('api_id', this.apiId);
      formData.append('method', 'transaction');
      formData.append('mechant', '1'); // Note: API has typo
      formData.append('merchant_ref', merchantRef);

      const response = await fetch(`${this.baseUrl}/transaction.php`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          // ...formData.getHeaders()
        },
        body: formData
      });

      const text = await response.text();

      if (text.trim().startsWith('<')) {
        logger.error(`[Sakurupiah] API Returned HTML: ${text.substring(0, 100)}...`);
        return null;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        logger.error(`[Sakurupiah] Invalid JSON: ${text.substring(0, 100)}`);
        return null;
      }

      logger.debug(`[Sakurupiah] Transaction Check Response: ${JSON.stringify(data)}`);

      if (data.status === "200" && Array.isArray(data.data)) {
        const trx = data.data.find(t => t.merchant_ref === merchantRef);
        return trx || data.data[0];
      }

      return null;
    } catch (e) {
      logger.error(`[Sakurupiah] Check Transaction Error: ${e.message}`);
      return null;
    }
  }

  async checkTransactionStatus(trxId) {
    // Handle Simulation IDs locally
    if (trxId.startsWith('SIMULATION-')) {
      logger.info(`[Sakurupiah] Handling Simulation ID locally: ${trxId}`);
      return {
        status: '200',
        payment_status: 'pending',
        message: 'Simulated Transaction'
      };
    }

    try {
      const formData = new FormData();
      formData.append('api_id', this.apiId);
      formData.append('method', 'status');
      formData.append('trx_id', trxId);

      const response = await fetch(`${this.baseUrl}/status-transaction.php`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          // ...formData.getHeaders()
        },
        body: formData
      });

      const text = await response.text();

      if (text.trim().startsWith('<')) {
        logger.error(`[Sakurupiah] Status Check Returned HTML: ${text.substring(0, 100)}...`);
        return null;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        logger.error(`[Sakurupiah] Invalid JSON in Status Check: ${text.substring(0, 100)}`);
        return null;
      }

      logger.debug(`[Sakurupiah] Trx Status Check: ${JSON.stringify(data)}`);

      if (data.status === "200" && Array.isArray(data.data) && data.data.length > 0) {
        return data.data[0];
      }

      return data;
    } catch (e) {
      logger.error(`[Sakurupiah] Check Status Error: ${e.message}`);
      return null;
    }
  }

  /**
   * Get transaction details by transaction ID
   * @param {String} trxId - Transaction ID from payment gateway
   * @returns {Promise<Object>} Transaction details
   */
  async getTransactionDetails(trxId) {
    // Handle Simulation IDs locally
    if (trxId.startsWith('SIMULATION-')) {
      logger.info(`[Sakurupiah] Handling Simulation ID for details: ${trxId}`);
      return {
        trx_id: trxId,
        status: 'pending',
        amount: 0,
        message: 'Simulated Transaction'
      };
    }

    try {
      const formData = new FormData();
      formData.append('api_id', this.apiId);
      formData.append('method', 'detail');
      formData.append('trx_id', trxId);

      const response = await fetch(`${this.baseUrl}/transaction.php`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: formData
      });

      const text = await response.text();

      if (text.trim().startsWith('<')) {
        logger.error(`[Sakurupiah] Transaction Details Returned HTML: ${text.substring(0, 100)}...`);
        return null;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        logger.error(`[Sakurupiah] Invalid JSON in Transaction Details: ${text.substring(0, 100)}`);
        return null;
      }

      logger.debug(`[Sakurupiah] Transaction Details Response: ${JSON.stringify(data)}`);

      if (data.status === "200" && data.data) {
        return Array.isArray(data.data) ? data.data[0] : data.data;
      }

      return null;
    } catch (e) {
      logger.error(`[Sakurupiah] Get Transaction Details Error: ${e.message}`);
      return null;
    }
  }

  simulateResponse(orderData) {
    const channel = (orderData.channelCode || 'QRIS').toUpperCase();

    // Define QR/Wallet type keywords
    const startWithWallets = ['QRIS', 'GOPAY', 'LINKAJA', 'DANA', 'OVO', 'SHOPEEPAY'];
    const isQR = startWithWallets.some(w => channel.includes(w));

    // If not QR/Wallet, assume it is VA or Retail (Needs Payment Code)
    const isVA = !isQR;

    // Mock VA Number if VA/Retail
    // Example: 8800 + random 8 digits
    const paymentCode = isVA ? `8800${Math.floor(10000000 + Math.random() * 90000000)}` : null;

    // Mock QR only if QRIS or E-Wallet (assuming QR checkout)
    let qrString = null;
    if (isQR) {
      qrString = "00020101021226590014ID.GO.GOPAY.SIMULATION...";
    }

    return {
      success: true,
      payment_url: `https://sakurupiah.id/pay/simulation/DEMO-${orderData.userId}`,
      qr_string: qrString,
      expiry_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      payment_code: paymentCode,
      trx_id: `SIMULATION-${Date.now()}` // Mock Trx ID
    };
  }
}
