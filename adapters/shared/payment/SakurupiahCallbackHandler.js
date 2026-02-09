import crypto from 'crypto';
import logger, { securityLogger } from '../../../core/shared/services/Logger.js';

export class SakurupiahCallbackHandler {
  constructor(apiKey, botCore) {
    this.apiKey = apiKey;
    this.bot = botCore; // Access to BotCore to send messages
  }

  /**
   * Handle incoming callback request
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleExpressRequest(req, res) {
    try {
      // 1. Get raw body for signature validation
      // Req.rawBody must be populated by express.json({ verify: ... }) middleware
      const rawBody = req.rawBody || JSON.stringify(req.body);
      // Note: JSON.stringify(req.body) might not match exact raw bytes if whitespace differs,
      // but if we use the verify middleware strategy it's safer.
      // For now, let's assume rawBody is available or we fallback.

      // 2. Signature Validation
      const clientSignature = req.headers['http_x_callback_signature'] || req.headers['x-callback-signature'] || '';
      const mySignature = crypto.createHmac('sha256', this.apiKey).update(rawBody).digest('hex');

      if (clientSignature !== mySignature) {
        securityLogger.warn(`[WEBHOOK_SIG_FAIL] Invalid Signature (Sakurupiah) | IP: ${req.ip} | Headers: ${JSON.stringify(req.headers)}`);
        logger.warn("[Callback] Invalid Signature");
        return res.status(403).json({ success: false, message: 'Invalid signature' });
      }

      // 3. Check Event
      const event = req.headers['http_x_callback_event'] || req.headers['x-callback-event'] || '';
      if (event !== 'payment_status') {
        return res.status(400).json({ success: false, message: 'Unrecognized callback event' });
      }

      // 4. Process Data & Deep Sync
      const { merchant_ref } = req.body;

      if (!this.bot || !this.bot.paymentService) {
        logger.warn("[Callback] Bot or PaymentService not ready");
        return res.json({ success: true, message: 'Bot not ready, but accepted' });
      }

      // Perform sync and check for status changes
      const { statusChanged, trx, newStatus } = await this.bot.paymentService.handleCallback(merchant_ref);

      if (!trx) {
        logger.warn(`[Callback] Transaction not found in DB: ${merchant_ref}`);
        return res.json({ success: true, message: 'Trx not found locally' });
      }

      // Only notify user IF status changed to a final/important state
      if (statusChanged) {
        let messageToUser = "";
        let shouldNotify = false;

        // Escape special chars for MarkdownV2: _ * [ ] ( ) ~ ` > # + - = | { } . !
        const escapeMdV2 = (text) => text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
        const escapedRef = escapeMdV2(merchant_ref);

        if (newStatus === "PAID") {
          messageToUser = `✅ *Pembayaran Berhasil\\!*\n\nTerima kasih Kak, pesanan dengan Ref: \`${escapedRef}\` sudah kami terima\\. Saldo/Item akan segera masuk\\! 🚀`;
          shouldNotify = true;
        } else if (newStatus === "EXPIRED") {
          messageToUser = `⚠️ *Pembayaran Expired*\n\nMaaf Kak, pesanan \`${escapedRef}\` sudah kadaluarsa\\. Silakan order ulang ya\\. 🙏`;
          shouldNotify = true;
        } else if (newStatus === "FAILED") {
          messageToUser = `❌ *Pembayaran Gagal*\n\nMaaf Kak, transaksi \`${escapedRef}\` dinyatakan gagal oleh sistem\\. Silakan hubungi admin\\.`;
          shouldNotify = true;
        }

        if (shouldNotify && trx.userId && this.bot.sendPort) {
          logger.info(`[Callback] Notifying user ${trx.userId} about status: ${newStatus}`);
          const options = { parse_mode: 'MarkdownV2' };

          if (trx.messageId) {
            try {
              // Try to edit caption first (assuming it was a photo invoice)
              await this.bot.sendPort.editMessageCaption(trx.userId, trx.messageId, messageToUser, options);
              logger.info(`[Callback] Updated bubble ${trx.messageId} via caption`);
            } catch (e1) {
              try {
                // Try to edit text (if it was a VA/Retail text invoice)
                await this.bot.sendPort.editMessageText(trx.userId, trx.messageId, messageToUser, options);
                logger.info(`[Callback] Updated bubble ${trx.messageId} via text`);
              } catch (e2) {
                logger.warn(`[Callback] Edit failed, sending new message: ${e2.message}`);
                await this.bot.sendPort.sendMessage(trx.userId, messageToUser, options);
              }
            }
          } else {
            await this.bot.sendPort.sendMessage(trx.userId, messageToUser, options);
          }
        }
      } else {
        logger.debug(`[Callback] Status no change for ${merchant_ref} (${newStatus}), suppression active.`);
      }

      // 5. Response
      res.json({ success: true, message: `Sync complete for ${merchant_ref}` });

    } catch (error) {
      logger.error("[Callback] Error:", error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  }
}
