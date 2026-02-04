/**
 * InfrastructurePort
 * 
 * Port (Interface) for infrastructure components that need lifecycle management.
 * Driven Adapters like CloudflareTunnel, NginxController, etc should implement this.
 */
export class InfrastructurePort {
    /**
     * Start the infrastructure component
     * @returns {Promise<void>}
     */
    async start() {
        throw new Error('Method not implemented');
    }

    /**
     * Stop the infrastructure component
     * @returns {Promise<void>}
     */
    async stop() {
        throw new Error('Method not implemented');
    }

    /**
     * Check health status
     * @returns {Promise<boolean>}
     */
    async isHealthy() {
        return true;
    }
}
