import { PaymentChannelRepositoryPort } from '../ports/PaymentChannelRepositoryPort.js';

/**
 * PaymentChannelRepository
 * Encapsulates database operations for PaymentChannel entity
 * Implements PaymentChannelRepositoryPort for Hexagonal Architecture
 */
export class PaymentChannelRepository extends PaymentChannelRepositoryPort {
  constructor(databasePort) {
    super();
    this.db = databasePort;
  }

  /**
   * Count total payment channels
   */
  async count() {
    return await this.db.client.paymentChannel.count();
  }

  /**
   * Get all payment channels
   */
  async getAll() {
    return await this.db.client.paymentChannel.findMany({
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Get only active payment channels
   */
  async getActive() {
    return await this.db.client.paymentChannel.findMany({
      where: { status: 'Aktif' },
      orderBy: { name: 'asc' }
    });
  }

  /**
   * Find payment channel by code
   */
  async findByCode(code) {
    return await this.db.client.paymentChannel.findUnique({
      where: { code }
    });
  }

  /**
   * Upsert single payment channel
   */
  async upsert(channelData) {
    const { code, ...data } = channelData;
    return await this.db.client.paymentChannel.upsert({
      where: { code },
      update: { ...data, lastSynced: new Date() },
      create: { code, ...data }
    });
  }

  /**
   * Batch upsert payment channels (for API sync)
   */
  async upsertMany(channels) {
    const operations = channels.map(channel => {
      const { code, ...data } = channel;
      return this.db.client.paymentChannel.upsert({
        where: { code },
        update: { ...data, lastSynced: new Date() },
        create: { code, ...data }
      });
    });
    return await this.db.client.$transaction(operations);
  }

  /**
   * Delete payment channel by code
   */
  async deleteByCode(code) {
    return await this.db.client.paymentChannel.delete({
      where: { code }
    });
  }

  /**
   * Delete all inactive channels
   */
  async deleteInactive() {
    return await this.db.client.paymentChannel.deleteMany({
      where: { status: { not: 'Aktif' } }
    });
  }
}
