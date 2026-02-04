import { CloudflareTunnelAdapter } from '../adapters/platform/CloudflareTunnelAdapter.js';

try {
    const adapter = new CloudflareTunnelAdapter();
    console.log('✅ Adapter instantiated successfully');
} catch (error) {
    console.error('❌ Failed to instantiate adapter:', error);
    process.exit(1);
}
