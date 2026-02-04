import logger from './Logger.js';

/**
 * TransactionSyncService
 * Responsibility: Handle the complex logic of synchronizing transaction status
 * between the local database and the payment gateway.
 */
export class TransactionSyncService {
    constructor(paymentPort, transactionRepository) {
        this.paymentPort = paymentPort;
        this.trxRepo = transactionRepository;
    }

    /**
     * Sync transaction status with payment gateway
     * @param {String} merchantRef - Merchant reference
     * @returns {Promise<Object>} Updated transaction data or null
     */
    async sync(merchantRef) {
        try {
            let trx = await this.trxRepo.findByRef(merchantRef);
            if (!trx) {
                trx = await this.trxRepo.findByTrxId(merchantRef);
            }

            if (!trx) return null;

            let freshStatus = null;
            
            // Smart Check: Use TrxId if available (more reliable)
            if (trx.trxId && !trx.trxId.startsWith('SIMULATION-')) {
                 logger.info(`[SyncService] Syncing via ID: ${trx.trxId}`);
                 freshStatus = await this.paymentPort.checkTransactionStatus(trx.trxId);
            } else {
                 logger.info(`[SyncService] Syncing via Ref: ${trx.merchantRef}`);
                 freshStatus = await this.paymentPort.checkTransaction(trx.merchantRef);
            }

            if (freshStatus) {
                const updateData = this._calculateUpdates(trx, freshStatus);
                
                if (Object.keys(updateData).length > 0) {
                    logger.info(`[SyncService] Updating Trx ${trx.merchantRef}:`, updateData);
                    await this.trxRepo.update(trx.merchantRef, updateData);
                    trx = { ...trx, ...updateData };
                }
            }
            
            return trx;
        } catch (error) {
            logger.error('[SyncService] Sync failed:', error);
            return await this.trxRepo.findByRef(merchantRef) || await this.trxRepo.findByTrxId(merchantRef);
        }
    }

    /**
     * Calculate required updates based on API response
     * @private
     */
    _calculateUpdates(trx, apiResponse) {
        const updateData = {};
        
        // 1. Capture TrxID
        if (apiResponse.trx_id && apiResponse.trx_id !== trx.trxId) {
            updateData.trxId = apiResponse.trx_id;
        }

        // 2. Map Status
        const apiStatus = apiResponse.payment_status || apiResponse.status;
        const mappedStatus = this._mapStatus(apiStatus);
        
        if (mappedStatus !== trx.status && mappedStatus !== 'UNPAID') {
            updateData.status = mappedStatus;
        }

        // 3. Sync Payment Info
        if (apiResponse.checkout_url && apiResponse.checkout_url !== trx.paymentUrl) {
            updateData.paymentUrl = apiResponse.checkout_url;
        }
        
        const payCode = String(apiResponse.payment_code || apiResponse.pay_code || "");
        if (payCode && payCode !== trx.paymentNo) {
            updateData.paymentNo = payCode;
        }

        const qrString = apiResponse.qr_string || apiResponse.qr;
        if (qrString && qrString !== trx.qrString) {
            updateData.qrString = qrString;
        }

        return updateData;
    }

    /**
     * Map gateway status to internal status
     * @private
     */
    _mapStatus(apiStatus) {
        if (!apiStatus) return 'UNPAID';
        const lowStatus = String(apiStatus).toLowerCase();
        
        if (lowStatus === 'success' || lowStatus === 'berhasil' || lowStatus === 'paid') return 'PAID';
        if (lowStatus === 'expired' || lowStatus === 'kadaluarsa') return 'EXPIRED';
        if (lowStatus === 'failed' || lowStatus === 'gagal') return 'FAILED';
        
        return 'UNPAID';
    }
}
