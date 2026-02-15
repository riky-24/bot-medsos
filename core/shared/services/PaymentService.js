/**
 * PaymentService - Core business logic for payment operations
 * 
 * Orchestrates payment operations by delegating to specialized services
 * and adapters.
 */
import logger from './Logger.js';
import { TIMEOUTS } from '../config/constants.js';
import { TransactionSyncService } from './TransactionSyncService.js';

export class PaymentService {
  /**
   * @param {PaymentPort} paymentPort - Payment gateway adapter
   * @param {PaymentChannelRepository} paymentChannelRepository - DB access
   * @param {TransactionRepository} transactionRepository - DB access
   * @param {GameProviderService} gameProviderService - Game provider service
   */
  constructor(paymentPort, paymentChannelRepository, transactionRepository, gameProviderService = null) {
    this.paymentPort = paymentPort;
    this.channelRepo = paymentChannelRepository;
    this.trxRepo = transactionRepository;
    this.gameProviderService = gameProviderService;

    // Sub-service for status synchronization
    this.syncService = new TransactionSyncService(paymentPort, transactionRepository);

    // Mutex for preventing concurrent sync operations
    this._syncInProgress = false;
  }

  /**
   * Helper to wrap promise with timeout
   */
  async _withTimeout(promise, context) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`API Timeout: ${context}`)), TIMEOUTS.API_TIMEOUT_MS);
    });
    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Safely parse JSON with fallback
   * @private
   * @param {string} jsonString - JSON string to parse
   * @param {any} defaultValue - Default value if parse fails
   * @returns {any}
   */
  _safeJsonParse(jsonString, defaultValue = null) {
    try {
      return jsonString ? JSON.parse(jsonString) : defaultValue;
    } catch (e) {
      logger.warn(`[PaymentService] JSON parse failed: ${e.message}`);
      return defaultValue;
    }
  }

  /**
   * Map database channel to API format
   * @private
   * @param {Object} channel - Database channel object
   * @returns {Object|null} API-formatted channel or null
   */
  _mapChannel(channel) {
    if (!channel) return null;

    return {
      kode: channel.code,
      nama: channel.name,
      biaya: channel.fee,
      minimal: channel.minAmount,
      maksimal: channel.maxAmount,
      metode: channel.method,
      tipe: channel.type,
      logo: channel.logo || null,
      status: channel.status,
      percent: channel.isPercent ? 'Percent' : 'Flat',
      guideTitle: channel.guideTitle,
      guideSteps: this._safeJsonParse(channel.guideSteps, null)
    };
  }

  /**
   * Get specific payment channel by code
   */
  async getChannelByCode(code) {
    try {
      const channel = await this.channelRepo.findByCode(code);
      return this._mapChannel(channel);
    } catch (error) {
      logger.error(`[PaymentService] Error getting channel ${code}:`, error);
      return null;
    }
  }

  /**
   * Get available payment channels
   */
  async getPaymentChannels(processSync = true) {
    try {
      let channels = await this.channelRepo.getAll();

      if ((!channels || channels.length === 0) && processSync) {
        logger.info('[PaymentService] Cache empty. Triggering sync...');
        await this.syncPaymentChannels();
        channels = await this.channelRepo.getAll();
      }

      if (channels && channels.length > 0) {
        return channels.map(c => this._mapChannel(c)).filter(Boolean);
      }

      return [];
    } catch (error) {
      logger.error('[PaymentService] Error getting channels:', error);
      return [];
    }
  }

  /**
   * Sync payment channels to database
   */
  async syncPaymentChannels(force = false) {
    // Prevent concurrent sync operations (mutex lock)
    if (this._syncInProgress) {
      logger.debug('[PaymentService] Sync already in progress, skipping duplicate call...');
      return;
    }

    const startTime = Date.now();

    try {
      this._syncInProgress = true;
      logger.info(`[PaymentService] 🔄 Starting payment channel sync (force=${force})...`);

      const TTL_HOURS = 6;
      const count = await this.channelRepo.count();
      logger.debug(`[PaymentService] Current channels in DB: ${count}`);

      let shouldSync = force || count === 0;
      if (!shouldSync) {
        const sample = await this.channelRepo.findByCode('QRIS');
        if (sample && sample.lastSynced) {
          const hoursSinceSync = (Date.now() - new Date(sample.lastSynced).getTime()) / (1000 * 60 * 60);
          if (hoursSinceSync > TTL_HOURS) {
            shouldSync = true;
            logger.info(`[PaymentService] Cache stale (${hoursSinceSync.toFixed(1)}h old, TTL=${TTL_HOURS}h). Syncing...`);
          } else {
            logger.debug(`[PaymentService] Cache still fresh (${hoursSinceSync.toFixed(1)}h old). Skipping sync.`);
          }
        } else if (count > 0) {
          // Channels exist but QRIS missing or no timestamp? Force sync for safety
          logger.warn('[PaymentService] QRIS channel missing or no sync timestamp. Forcing sync...');
          shouldSync = true;
        }
      }

      if (!shouldSync) {
        logger.info('[PaymentService] ✓ Payment channels up to date (skipped sync)');
        return;
      }

      logger.info('[PaymentService] Fetching channels from payment gateway API...');
      const response = await this.paymentPort.getPaymentChannels();

      // Check for structured error response from adapter
      if (response && response.success === false) {
        logger.error(`[PaymentService] Payment gateway error: ${response.error}`);
        logger.error(`[PaymentService] Error type: ${response.errorType}`);
        // Could notify admin or trigger alert here if needed
        return;
      }

      const channels = response.data || response;

      // Enhanced validation with better error logging
      if (!Array.isArray(channels)) {
        logger.error(`[PaymentService] Invalid API response format. Expected array, got: ${typeof channels}`);
        logger.debug(`[PaymentService] Response preview: ${JSON.stringify(response).substring(0, 200)}`);
        return;
      }

      if (channels.length === 0) {
        logger.warn('[PaymentService] API returned 0 payment channels. Payment gateway might be down or misconfigured.');
        return;
      }

      logger.info(`[PaymentService] Processing ${channels.length} channels from API...`);
      let successCount = 0;
      let errorCount = 0;

      for (const channel of channels) {
        try {
          const isPercent = channel.percent === 'Percent';
          await this.channelRepo.upsert({
            code: channel.kode,
            name: channel.nama,
            minAmount: parseInt(channel.minimal, 10) || 0,
            maxAmount: parseInt(channel.maksimal, 10) || 0,
            feeFlat: isPercent ? 0 : (parseInt(channel.biaya, 10) || 0),
            feePercent: isPercent ? channel.biaya : null,
            fee: channel.biaya,
            isPercent: isPercent,
            type: channel.tipe,
            method: channel.metode,
            logo: channel.logo,
            status: channel.status,
            guideTitle: channel.guide?.title || null,
            guideSteps: channel.guide?.payment_guide
              ? JSON.stringify(channel.guide.payment_guide.split(/\r?\n/).filter(line => line.trim().length > 0))
              : null
          });
          successCount++;
        } catch (channelError) {
          errorCount++;
          logger.error(`[PaymentService] Failed to upsert channel ${channel.kode}: ${channelError.message}`);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`[PaymentService] ✅ Sync complete: ${successCount} channels synced, ${errorCount} errors, took ${duration}s`);

    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.error(`[PaymentService] ❌ Sync failed after ${duration}s:`, error);
    } finally {
      // Always release mutex lock
      this._syncInProgress = false;
    }
  }

  /**
   * Calculate final amount including fees
   */
  async calculateFinalAmount(baseAmount, channelCode) {
    const channel = await this.channelRepo.findByCode(channelCode);
    if (!channel) throw new Error(`Payment channel ${channelCode} not found`);

    const base = BigInt(baseAmount);
    let feeAmount;

    if (channel.feePercent) {
      // Use Number for percentage calculation as precision for money in IDR is usually safe
      // but convert back to BigInt for consistency
      const percent = parseFloat(channel.feePercent);
      feeAmount = BigInt(Math.round(Number(base) * (percent / 100)));
    } else {
      feeAmount = BigInt(channel.feeFlat || 0);
    }

    const finalAmount = base + feeAmount;

    return {
      baseAmount: base,
      feeAmount: feeAmount,
      finalAmount: finalAmount,
      channelInfo: { code: channel.code, name: channel.name, method: channel.method },
      feeType: channel.isPercent ? 'Percent' : 'Flat'
    };
  }

  /**
   * Create payment invoice and save to DB
   */
  async createInvoice(orderData) {
    const sanitizedUserId = String(orderData.userId || 'UNKNOWN').replace(/\s+/g, '-');
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const merchantRef = `ORDER-${sanitizedUserId}-${Date.now()}-${randomSuffix}`;

    try {
      // Wrap with timeout
      const result = await this._withTimeout(
        this.paymentPort.createInvoice({ ...orderData, merchantRef }),
        `Create Invoice ${merchantRef}`
      );

      if (result.success && this.trxRepo) {
        try {
          await this.trxRepo.save({
            merchantRef,
            trxId: result.trx_id || null,
            userId: orderData.userId.toString(),
            customerName: orderData.playerId || orderData.customerName || 'Unknown',
            game: orderData.game,
            item: orderData.item,
            nickname: orderData.nickname || null,
            playerId: orderData.playerId ? String(orderData.playerId) : null,
            zoneId: orderData.zoneId ? String(orderData.zoneId) : null,
            gameCode: orderData.game, // Internal/Provider game code
            serviceCode: orderData.code, // Provider service ID
            amount: orderData.amount,
            channel: orderData.channelCode || 'QRIS',
            status: 'UNPAID',
            paymentUrl: result.payment_url,
            paymentNo: result.payment_code ? String(result.payment_code) : null,
            qrString: result.qr_string,
            expiryDate: result.expiry_date ? new Date(result.expiry_date) : null
          });
        } catch (e) {
          logger.error('[PaymentService] Save failed:', e);
        }
      }

      return { ...result, merchantRef, status: 'UNPAID' };
    } catch (error) {
      logger.error(`[PaymentService] Create invoice failed: ${error.message}`);
      return {
        success: false,
        message: 'Payment gateway error',
        error: error.message
      };
    }
  }

  /**
   * Update transaction messageId for bubble tracking
   */
  async updateTransactionMessageId(merchantRef, messageId) {
    if (!this.trxRepo) return;
    try {
      logger.info(`[PaymentService] Tracking messageId ${messageId} for ${merchantRef}`);
      await this.trxRepo.update(merchantRef, { messageId: parseInt(messageId, 10) });
    } catch (e) {
      logger.warn(`[PaymentService] Failed to update messageId: ${e.message}`);
    }
  }

  /**
   * Sync transaction status via Sub-Service
   */
  async syncTransaction(merchantRef) {
    return await this.syncService.sync(merchantRef);
  }

  /**
   * Handle incoming callback from payment gateway
   * Logic: Sync status, and determine if notification is needed
   * @returns {Object} { statusChanged: boolean, trx: object, oldStatus: string }
   */
  async handleCallback(merchantRef) {
    const oldTrx = await this.trxRepo.findByRef(merchantRef) || await this.trxRepo.findByTrxId(merchantRef);
    const oldStatus = oldTrx?.status || 'UNPAID';

    const updatedTrx = await this.syncTransaction(merchantRef);
    const newStatus = updatedTrx?.status || 'UNPAID';

    const result = {
      statusChanged: oldStatus !== newStatus,
      trx: updatedTrx,
      oldStatus,
      newStatus
    };

    // Auto-fulfillment bridge
    if (result.statusChanged && newStatus === 'PAID') {
      logger.info(`[PaymentService] Triggering auto-fulfillment for ${merchantRef}`);
      this.fulfillGameOrder(updatedTrx).catch(err => {
        logger.error(`[PaymentService] Fulfillment failed for ${merchantRef}: ${err.message}`);
      });
    }

    return result;
  }

  /**
   * Orchestrate game delivery
   * @private
   */
  async fulfillGameOrder(trx) {
    if (!this.gameProviderService) {
      logger.warn('[PaymentService] fulfillGameOrder skipped: GameProviderService not injected');
      return;
    }

    if (!trx.gameCode || !trx.serviceCode || !trx.playerId) {
      logger.warn(`[PaymentService] fulfillGameOrder skipped: Missing delivery data for ${trx.merchantRef}`);
      return;
    }

    const orderData = {
      serviceId: trx.serviceCode,
      playerId: trx.playerId,
      zoneId: trx.zoneId,
      merchantRef: trx.merchantRef
    };

    logger.info(`[PaymentService] Sending order to provider: ${trx.merchantRef} (${trx.item})`);
    const result = await this.gameProviderService.createOrder(orderData);

    if (result.success) {
      logger.info(`[PaymentService] Provider accepted order: ${trx.merchantRef}. OrderID: ${result.orderId}`);
      if (result.orderId) {
        await this.trxRepo.update(trx.merchantRef, {
          trxId: result.orderId
        });
      }
    } else {
      logger.error(`[PaymentService] Provider rejected order: ${trx.merchantRef} - ${result.message}`);
    }
  }

  /**
   * Get user transaction history
   * @param {String} userId - Telegram ID
   * @param {Number} limit - Max items
   */
  async getUserTransactionHistory(userId, limit = 5) {
    return await this.trxRepo.findByUserId(userId, limit);
  }

  /**
   * Prepare data for Reprint/Invoice display
   */
  async reprintTransaction(merchantRef) {
    const trx = await this.syncTransaction(merchantRef);
    if (!trx) throw new Error('Transaction not found');

    return {
      trx,
      orderData: {
        game: trx.game,
        item: trx.item,
        amount: trx.amount,
        userId: trx.userId,
        merchantRef: trx.merchantRef,
        channelCode: trx.channel,
        customerName: trx.customerName || trx.userId,
        createdAt: trx.createdAt
      },
      result: {
        success: true,
        trx_id: trx.trxId,
        payment_url: trx.paymentUrl,
        payment_code: trx.paymentNo,
        qr_string: trx.qrString,
        expiry_date: trx.expiryDate,
        status: trx.status
      }
    };
  }

  isQRChannel(channelCode) {
    if (!channelCode) return false;
    const code = channelCode.toUpperCase();
    const qrWallets = ['QRIS', 'GOPAY', 'LINKAJA', 'DANA', 'OVO', 'SHOPEEPAY'];
    return qrWallets.some(w => code.includes(w));
  }
}
