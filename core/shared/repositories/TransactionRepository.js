import { PAYMENT_STATUS } from '../config/constants.js';
import { TransactionRepositoryPort } from '../ports/TransactionRepositoryPort.js';

/**
 * TransactionRepository
 * Database access for Transaction model
 * Implements TransactionRepositoryPort for Hexagonal Architecture
 */
export class TransactionRepository extends TransactionRepositoryPort {
  constructor(databasePort) {
    super();
    this.db = databasePort;
  }

  /**
   * Create new transaction
   */
  async save(data) {
    return await this.db.client.transaction.create({
      data
    });
  }

  /**
   * Update transaction status
   */
  async updateStatus(merchantRef, status, trxId = null) {
    const data = { status };
    if (trxId) data.trxId = trxId;

    return await this.db.client.transaction.update({
      where: { merchantRef },
      data
    });
  }

  /**
   * Update transaction data
   */
  async update(merchantRef, data) {
    return await this.db.client.transaction.update({
      where: { merchantRef },
      data
    });
  }

  /**
   * Mark transaction as paid (shortcut for payment callback)
   */
  async markAsPaid(merchantRef, trxId = null) {
    const data = {
      status: PAYMENT_STATUS.PAID,
      paidAt: new Date()
    };
    if (trxId) data.trxId = trxId;

    return await this.db.client.transaction.update({
      where: { merchantRef },
      data
    });
  }

  /**
   * Find transaction by merchant reference
   */
  async findByRef(merchantRef) {
    return await this.db.client.transaction.findUnique({
      where: { merchantRef }
    });
  }

  /**
   * Find transaction by trxId (from payment gateway)
   */
  async findByTrxId(trxId) {
    return await this.db.client.transaction.findUnique({
      where: { trxId }
    });
  }

  /**
   * Find transactions by userId
   */
  async findByUserId(userId, limit = 5) {
    return await this.db.client.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  /**
   * Find expired unpaid transactions
   * Returns transactions that are UNPAID and past their expiryDate
   */
  async findExpiredUnpaid() {
    return await this.db.client.transaction.findMany({
      where: {
        status: PAYMENT_STATUS.UNPAID,
        expiryDate: { lt: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Mark all expired transactions as EXPIRED
   */
  async markExpiredTransactions() {
    return await this.db.client.transaction.updateMany({
      where: {
        status: PAYMENT_STATUS.UNPAID,
        expiryDate: { lt: new Date() }
      },
      data: { status: PAYMENT_STATUS.EXPIRED }
    });
  }
}
