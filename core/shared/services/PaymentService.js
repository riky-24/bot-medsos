/**
 * PaymentService - Core business logic for payment operations
 * 
 * Orchestrates payment operations by delegating to specialized services
 * and adapters.
 */
import logger from './Logger.js';

import { TransactionSyncService } from './TransactionSyncService.js';
import { TIMEOUTS } from '../../applications/bot-telegram/useCases/handlers/HandlerConstants.js';

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
   * Get specific payment channel by code
   */
  async getChannelByCode(code) {
    try {
      const channel = await this.channelRepo.findByCode(code);
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
        guideSteps: channel.guideSteps ? JSON.parse(channel.guideSteps) : null
      };
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
        return channels.map(c => ({
          kode: c.code,
          nama: c.name,
          biaya: c.fee,
          minimal: c.minAmount,
          maksimal: c.maxAmount,
          metode: c.method,
          tipe: c.type,
          logo: c.logo,
          status: c.status,
          percent: c.isPercent ? 'Percent' : 'Flat',
          guideTitle: c.guideTitle,
          guideSteps: c.guideSteps ? JSON.parse(c.guideSteps) : null
        }));
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
    try {
      const TTL_HOURS = 6;
      const count = await this.channelRepo.count();

      let shouldSync = force || count === 0;
      if (!shouldSync) {
        const sample = await this.channelRepo.findByCode('QRIS');
        if (sample) {
          const hoursSinceSync = (Date.now() - new Date(sample.lastSynced).getTime()) / (1000 * 60 * 60);
          if (hoursSinceSync > TTL_HOURS) {
            shouldSync = true;
            logger.info(`[PaymentService] Cache stale (${hoursSinceSync.toFixed(1)}h). Syncing...`);
          }
        }
      }

      if (!shouldSync) return;

      logger.info('[PaymentService] Syncing channels from API...');
      const response = await this.paymentPort.getPaymentChannels();
      const channels = response.data || response;

      if (!Array.isArray(channels)) return;

      for (const channel of channels) {
        const isPercent = channel.percent === 'Percent';
        await this.channelRepo.upsert({
          code: channel.kode,
          name: channel.nama,
          minAmount: parseInt(channel.minimal) || 0,
          maxAmount: parseInt(channel.maksimal) || 0,
          feeFlat: isPercent ? 0 : (parseInt(channel.biaya) || 0),
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
      }
    } catch (error) {
      logger.error('[PaymentService] Sync error:', error);
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
      await this.trxRepo.update(merchantRef, { messageId: parseInt(messageId) });
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
