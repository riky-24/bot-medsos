import crypto from 'crypto';
import { GameProviderPort } from '../../../core/shared/ports/GameProviderPort.js';
import logger from '../../../core/shared/services/Logger.js';

/**
 * VIPResellerAdapter
 * Game provider adapter for VIP-Reseller (vip-reseller.co.id)
 */
export class VIPResellerAdapter extends GameProviderPort {
  /**
   * @param {String} apiKey - VIPReseller API Key
   * @param {String} apiId - VIPReseller API ID
   * @param {Object} config - Optional configuration
   * @param {String} config.baseUrl - API base URL (defaults to production)
   * @param {Number} config.timeout - Request timeout in ms
   */
  constructor(apiKey, apiId, config = {}) {
    super();
    this.apiKey = apiKey;
    this.apiId = apiId;
    this.baseUrl = config.baseUrl || process.env.VIPRESELLER_BASE_URL || 'https://vip-reseller.co.id/api/game-feature';
    this.timeout = config.timeout || 30000;
  }

  generateSign() {
    // Ensure credentials are trimmed strings to avoid sneaky spaces in .env
    const id = String(this.apiId || '').trim();
    const key = String(this.apiKey || '').trim();
    return crypto
      .createHash('md5')
      .update(id + key)
      .digest('hex');
  }

  async makeRequest(payload) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), this.timeout);
    });

    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, String(value));
      }
    });

    // Explicitly add api_id to body if missing (common in many versions of this API)
    if (!payload.api_id && this.apiId) {
      formData.append('api_id', String(this.apiId).trim());
    }

    const fetchPromise = fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
        // Content-Type multipart/form-data is set automatically by fetch when body is FormData
      },
      body: formData
    });

    try {
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      const data = await response.json();
      logger.debug(`[VIPReseller] API Response: ${JSON.stringify(data).substring(0, 500)}`);

      if (data.result === false && data.message && (data.message.includes('IP') || data.message.includes('Signature'))) {
        throw new Error(`${data.message}`);
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  async orderTopUp(orderData) {
    if (!this.apiKey || !this.apiId) {
      throw new Error('VIPReseller Credentials missing');
    }

    try {
      const payload = {
        key: this.apiKey,
        sign: this.generateSign(),
        type: 'order',
        service: orderData.serviceId,
        data_no: orderData.playerId,
        data_zone: orderData.zoneId || ''
      };

      const data = await this.makeRequest(payload);
      if (data.result === true && data.data) {
        return {
          success: true,
          orderId: data.data.trxid,
          status: data.data.status || 'processing',
          serial: data.data.sn || data.data.note || null,
          message: data.message || 'Order berhasil'
        };
      }
      return { success: false, message: data.message || 'Order gagal' };
    } catch (error) {
      logger.error(`[VIPReseller] Order Error: ${error.message}`);
      throw error;
    }
  }

  async getGameServices(gameCode) {
    if (!this.apiKey || !this.apiId) {
      return [];
    }

    try {
      const payload = {
        key: this.apiKey,
        sign: this.generateSign(),
        type: 'services',
        filter_game: gameCode
      };

      const data = await this.makeRequest(payload);

      if (data.result === true && Array.isArray(data.data)) {
        return data.data.map(service => ({
          id: service.code || `${service.game}-${service.name}`.replace(/\s+/g, '-').toLowerCase(),
          name: service.name,
          game: service.game,
          price: parseInt(service.price?.basic || 0),
          priceTiers: {
            basic: parseInt(service.price?.basic || 0),
            premium: parseInt(service.price?.premium || 0),
            special: parseInt(service.price?.special || 0)
          },
          status: service.status,
          description: service.description || '',
          category: service.category || 'default'
        })).filter(s => s.price > 0);
      }
      return [];
    } catch (error) {
      logger.warn(`[VIPReseller] Get services simulation: ${error.message}`);
      return this.simulateServicesResponse(gameCode);
    }
  }

  async checkOrderStatus(orderId) {
    if (!this.apiKey || !this.apiId) {
      throw new Error('VIPReseller Credentials missing');
    }
    try {
      const payload = {
        key: this.apiKey,
        sign: this.generateSign(),
        type: 'status',
        trxid: orderId
      };
      const data = await this.makeRequest(payload);
      if (data.result === true && data.data) {
        // Data can be an array or object
        const trx = Array.isArray(data.data) ? data.data[0] : data.data;
        return {
          status: trx.status || 'unknown',
          serial: trx.sn || trx.note || null,
          message: data.message
        };
      }
      return { status: 'error', message: data.message };
    } catch (error) {
      logger.error(`[VIPReseller] Status Check Error: ${error.message}`);
      throw error;
    }
  }

  async getPlayerInfo(gameCode, playerId, zoneId = null) {
    if (!this.apiKey || !this.apiId) {
      throw new Error('VIPReseller Credentials missing (Validation skipped)');
    }
    try {
      const payload = {
        key: this.apiKey,
        sign: this.generateSign(),
        type: 'nickname',
        code: gameCode,
        target: String(playerId).trim(),
        additional_target: zoneId ? String(zoneId).trim() : ''
      };

      const data = await this.makeRequest(payload);

      if (data.result === true) {
        logger.info(`[VIPReseller] ✅ Nickname check SUCCESS | GameCode: ${gameCode} | PlayerId: ${playerId} | ZoneId: ${zoneId || 'null'} | Nickname: ${data.data}`);
        return {
          success: true,
          nickname: data.data, // Data is the nickname string
          playerId,
          zoneId
        };
      }

      // Comprehensive logging untuk failed response
      const rawResponse = JSON.stringify(data).substring(0, 300);
      logger.warn(`[VIPReseller] ❌ Nickname check FAILED | GameCode: ${gameCode} | PlayerId: ${playerId} | ZoneId: ${zoneId || 'null'} | APIMessage: ${data.message || 'N/A'} | RawResponse: ${rawResponse}`);

      return { success: false, message: data.message || 'ID tidak ditemukan' };
    } catch (error) {
      // Comprehensive crash logging
      const stackLines = error.stack ? error.stack.split('\\n').slice(0, 3).join(' | ') : 'N/A';
      logger.error(`[VIPReseller] 🔥 Nickname check CRASH | GameCode: ${gameCode} | PlayerId: ${playerId} | ZoneId: ${zoneId || 'null'} | Error: ${error.message} | Stack: ${stackLines}`);
      throw error;
    }
  }
}
