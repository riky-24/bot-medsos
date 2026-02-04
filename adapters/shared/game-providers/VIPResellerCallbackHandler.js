import crypto from 'crypto';
import logger, { securityLogger } from '../../../core/shared/services/Logger.js';

export class VIPResellerCallbackHandler {
    constructor(apiId, apiKey, botCore) {
        this.apiId = apiId;
        this.apiKey = apiKey;
        this.bot = botCore;
    }

    /**
     * Handle incoming callback from VIPReseller
     * VIPReseller posts data as x-www-form-urlencoded
     */
    async handleExpressRequest(req, res) {
        try {
            const payload = req.body;
            logger.info(`[VIPReseller-Callback] Raw Body: ${JSON.stringify(payload)}`);

            // 1. Signature Validation (Header-based per doc)
            // Doc says: X-Client-Signature = md5(API ID + API KEY)
            const clientSignature = req.headers['x-client-signature'];

            const id = String(this.apiId || '').trim();
            const key = String(this.apiKey || '').trim();
            const myStaticSign = crypto.createHash('md5').update(id + key).digest('hex');

            if (clientSignature !== myStaticSign) {
                securityLogger.warn(`[WEBHOOK_SIG_FAIL] Invalid Signature (VIPReseller) | IP: ${req.ip} | Expected: ${myStaticSign} | Got: ${clientSignature}`);
                logger.warn(`[VIPReseller-Callback] Invalid Signature from ${req.ip}. Expected: ${myStaticSign}, Got: ${clientSignature}`);
                return res.status(403).json({ success: false, message: 'Invalid signature' });
            }

            // 2. Data Extraction
            // Doc says: payload has "data" property containing trxid, etc.
            const data = payload.data;
            if (!data || !data.trxid) {
                logger.warn(`[VIPReseller-Callback] Missing data object or trxid`);
                return res.status(400).json({ success: false, message: 'Missing data' });
            }

            const { trxid, status, sn } = data;

            // 3. Update Transaction in Core
            if (this.bot && this.bot.dependencies.databasePort) {
                const db = this.bot.dependencies.databasePort;

                // Find transaction by provider's trxid
                const trx = await db.client.transaction.findFirst({
                    where: { trxId: trxid }
                });

                if (!trx) {
                    logger.warn(`[VIPReseller-Callback] Transaction not found for ID: ${trxid}`);
                    return res.json({ success: true, message: 'Trx not found locally' });
                }

                // Map status
                let newStatus = 'PROCESSING';
                if (status === 'success') newStatus = 'SUCCESS';
                if (status === 'error' || status === 'failed') newStatus = 'FAILED';

                await db.client.transaction.update({
                    where: { id: trx.id },
                    data: {
                        status: newStatus === 'SUCCESS' ? 'PAID' : trx.status
                    }
                });

                // 4. Notify User via Bot
                if (this.bot.sendPort && trx.userId) {
                    let message = "";
                    if (status === 'success') {
                        message = `✅ **Topup Berhasil!**\n\nProduk: ${trx.item}\nSN: \`${sn || '-'}\`\n\nTerima kasih sudah order! 🚀`;
                    } else if (status === 'error' || status === 'failed') {
                        message = `❌ **Topup Gagal**\n\nMaaf Kak, pesanan ${trx.item} gagal diproses oleh provider. Silakan hubungi admin untuk refund/cek manual.`;
                    }

                    if (message) {
                        try {
                            await this.bot.sendPort.sendMessage(trx.userId, message, { parse_mode: 'Markdown' });
                        } catch (e) {
                            logger.error(`[VIPReseller-Callback] Failed to notify user ${trx.userId}: ${e.message}`);
                        }
                    }
                }
            }

            res.json({ success: true });
        } catch (error) {
            logger.error("[VIPReseller-Callback] Error:", error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }
}
