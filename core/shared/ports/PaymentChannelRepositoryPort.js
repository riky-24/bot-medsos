/**
 * PaymentChannelRepositoryPort - Interface for PaymentChannel data operations
 * 
 * This port defines the contract for PaymentChannel repositories.
 * Following Hexagonal Architecture: Core depends on interface, not implementation.
 */
export class PaymentChannelRepositoryPort {
    /**
     * Count total payment channels
     * @returns {Promise<Number>}
     */
    async count() {
        throw new Error('PaymentChannelRepositoryPort.count() must be implemented');
    }

    /**
     * Get all payment channels
     * @returns {Promise<Array>}
     */
    async getAll() {
        throw new Error('PaymentChannelRepositoryPort.getAll() must be implemented');
    }

    /**
     * Get only active payment channels
     * @returns {Promise<Array>}
     */
    async getActive() {
        throw new Error('PaymentChannelRepositoryPort.getActive() must be implemented');
    }

    /**
     * Find payment channel by code
     * @param {String} code
     * @returns {Promise<Object|null>}
     */
    async findByCode(code) {
        throw new Error('PaymentChannelRepositoryPort.findByCode() must be implemented');
    }

    /**
     * Upsert single payment channel
     * @param {Object} channelData
     * @returns {Promise<Object>}
     */
    async upsert(channelData) {
        throw new Error('PaymentChannelRepositoryPort.upsert() must be implemented');
    }

    /**
     * Batch upsert payment channels
     * @param {Array} channels
     * @returns {Promise<Array>}
     */
    async upsertMany(channels) {
        throw new Error('PaymentChannelRepositoryPort.upsertMany() must be implemented');
    }

    /**
     * Delete payment channel by code
     * @param {String} code
     * @returns {Promise<Object>}
     */
    async deleteByCode(code) {
        throw new Error('PaymentChannelRepositoryPort.deleteByCode() must be implemented');
    }

    /**
     * Delete all inactive channels
     * @returns {Promise<Object>}
     */
    async deleteInactive() {
        throw new Error('PaymentChannelRepositoryPort.deleteInactive() must be implemented');
    }
}
