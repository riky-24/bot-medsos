/**
 * TransactionRepositoryPort - Interface for Transaction data operations
 * 
 * This port defines the contract for Transaction repositories.
 * Following Hexagonal Architecture: Core depends on interface, not implementation.
 */
export class TransactionRepositoryPort {
    /**
     * Create new transaction
     * @param {Object} data - Transaction data
     * @returns {Promise<Object>}
     */
    async save(data) {
        throw new Error('TransactionRepositoryPort.save() must be implemented');
    }

    /**
     * Update transaction status
     * @param {String} merchantRef
     * @param {String} status
     * @param {String} trxId - Optional transaction ID
     * @returns {Promise<Object>}
     */
    async updateStatus(merchantRef, status, trxId) {
        throw new Error('TransactionRepositoryPort.updateStatus() must be implemented');
    }

    /**
     * Update transaction data
     * @param {String} merchantRef
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async update(merchantRef, data) {
        throw new Error('TransactionRepositoryPort.update() must be implemented');
    }

    /**
     * Mark transaction as paid
     * @param {String} merchantRef
     * @param {String} trxId - Optional
     * @returns {Promise<Object>}
     */
    async markAsPaid(merchantRef, trxId) {
        throw new Error('TransactionRepositoryPort.markAsPaid() must be implemented');
    }

    /**
     * Find transaction by merchant reference
     * @param {String} merchantRef
     * @returns {Promise<Object|null>}
     */
    async findByRef(merchantRef) {
        throw new Error('TransactionRepositoryPort.findByRef() must be implemented');
    }

    /**
     * Find transaction by payment gateway trxId
     * @param {String} trxId
     * @returns {Promise<Object|null>}
     */
    async findByTrxId(trxId) {
        throw new Error('TransactionRepositoryPort.findByTrxId() must be implemented');
    }

    /**
     * Find transactions by userId
     * @param {String} userId
     * @param {Number} limit
     * @returns {Promise<Array>}
     */
    async findByUserId(userId, limit) {
        throw new Error('TransactionRepositoryPort.findByUserId() must be implemented');
    }

    /**
     * Find expired unpaid transactions
     * @returns {Promise<Array>}
     */
    async findExpiredUnpaid() {
        throw new Error('TransactionRepositoryPort.findExpiredUnpaid() must be implemented');
    }

    /**
     * Mark all expired transactions as EXPIRED
     * @returns {Promise<Object>}
     */
    async markExpiredTransactions() {
        throw new Error('TransactionRepositoryPort.markExpiredTransactions() must be implemented');
    }
}
