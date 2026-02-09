import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import https from 'https';
import os from 'os';
import logger from '../../core/shared/services/Logger.js';
import { InfrastructurePort } from '../../core/shared/ports/InfrastructurePort.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '../../..');

export class CloudflareTunnelAdapter extends InfrastructurePort {
    constructor(config = {}) {
        super();
        this.token = config.token || process.env.CLOUDFLARE_TUNNEL_TOKEN;
        this.port = config.port || process.env.CALLBACK_PORT || 3000;

        // Determine binary name based on platform (add .exe for Windows)
        this.binName = os.platform() === 'win32' ? 'cloudflared.exe' : 'cloudflared';

        // Store binary in infrastructure directory (hexagonal architecture)
        // Path: infrastructure/cloudflare-tunnel/bin/
        this.binDir = path.resolve(ROOT_DIR, 'infrastructure', 'cloudflare-tunnel', 'bin');
        this.binPath = path.resolve(this.binDir, this.binName);
        this.tunnelProcess = null;
        this._signalHandlersRegistered = false;
    }

    async start() {
        await this._ensureBinary();

        logger.info('[Tunnel] Starting Cloudflare Tunnel...');

        let args = [];
        if (this.token) {
            logger.info('[Tunnel] Using Tunnel Token');
            args = ['tunnel', 'run', '--token', this.token];
        } else {
            logger.warn('[Tunnel] No Token found. Starting Quick Tunnel...');
            args = ['tunnel', '--url', `http://localhost:${this.port}`];
        }

        // Spawn process
        this.tunnelProcess = spawn(this.binPath, args, {
            cwd: ROOT_DIR,
            stdio: ['ignore', 'pipe', 'pipe'] // Pipe stdout/stderr
        });

        this.tunnelProcess.stdout.on('data', (data) => {
            // Log connection success
            const msg = data.toString();
            if (msg.includes('Registered tunnel connection')) {
                logger.info('[Tunnel] ✓ Connection Established');
            }
            // Optional: verbose logging
            // logger.debug(`[Tunnel] ${msg.trim()}`);
        });

        this.tunnelProcess.stderr.on('data', (data) => {
            const msg = data.toString();
            if (msg.includes('Registered tunnel connection')) {
                logger.info('[Tunnel] ✓ Connection Established');
            }
            if (msg.includes('ERR')) {
                logger.error(`[Tunnel] ${msg.trim()}`);
            }
        });

        this.tunnelProcess.on('close', (code) => {
            if (code !== 0 && code !== null) {
                logger.error(`[Tunnel] Process exited with code ${code}`);
            } else {
                logger.info('[Tunnel] Stopped.');
            }
        });

        // Ensure we kill tunnel when app dies (register only once)
        if (!this._signalHandlersRegistered) {
            process.on('SIGINT', () => this.stop());
            process.on('SIGTERM', () => this.stop());
            this._signalHandlersRegistered = true;
        }
    }

    async stop() {
        if (this.tunnelProcess && !this.tunnelProcess.killed) {
            logger.info('[Tunnel] Stopping...');
            this.tunnelProcess.kill();
        }
    }

    async _ensureBinary() {
        if (fs.existsSync(this.binPath)) {
            // Optional: We could check checksum here in future
            return;
        }

        // Ensure directory exists
        if (!fs.existsSync(this.binDir)) {
            fs.mkdirSync(this.binDir, { recursive: true });
        }

        logger.warn('[Tunnel] Binary not found. Downloading...');
        const url = this._getBinaryUrl();

        try {
            await this._downloadFile(url, this.binPath);

            // Make executable on Linux/Mac
            if (os.platform() !== 'win32') {
                fs.chmodSync(this.binPath, '755');
            }

            logger.info('[Tunnel] ✓ Download complete & executable.');
        } catch (e) {
            logger.error(`[Tunnel] Failed to download from ${url}: ${e.message}`);
            // Clean up partial file
            if (fs.existsSync(this.binPath)) fs.unlinkSync(this.binPath);
            throw e;
        }
    }

    _getBinaryUrl() {
        const platform = os.platform();
        const arch = os.arch();

        let targetPlatform = '';
        let targetArch = '';

        // Map Platform
        switch (platform) {
            case 'linux': targetPlatform = 'linux'; break;
            case 'darwin': targetPlatform = 'darwin'; break;
            case 'win32': targetPlatform = 'windows'; break;
            default: throw new Error(`Unsupported Platform: ${platform}`);
        }

        // Map Architecture
        // Node: x64, arm64, arm, ia32
        // Cloudflare: amd64, arm64, 386, arm
        if (arch === 'x64') targetArch = 'amd64';
        else if (arch === 'arm64') targetArch = 'arm64';
        else if (arch === 'arm') targetArch = 'arm'; // Pi 32bit
        else if (arch === 'ia32') targetArch = '386';
        else throw new Error(`Unsupported Architecture: ${arch}`);

        const ext = platform === 'win32' ? '.exe' : '';
        return `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-${targetPlatform}-${targetArch}${ext}`;
    }

    _downloadFile(url, dest) {
        return new Promise((resolve, reject) => {
            const request = https.get(url, (response) => {
                // Handle Redirects (GitHub releases redirect to AWS S3 usually)
                if (response.statusCode === 301 || response.statusCode === 302) {
                    if (!response.headers.location) {
                        return reject(new Error('Redirect with no location'));
                    }
                    // Recursive call for redirect
                    return this._downloadFile(response.headers.location, dest)
                        .then(resolve)
                        .catch(reject);
                }

                if (response.statusCode !== 200) {
                    return reject(new Error(`Status Code: ${response.statusCode}`));
                }

                const file = fs.createWriteStream(dest);
                response.pipe(file);

                file.on('finish', () => {
                    file.close(() => resolve());
                });

                file.on('error', (err) => {
                    fs.unlink(dest, () => { });
                    reject(err);
                });
            });

            request.on('error', (err) => {
                fs.unlink(dest, () => { });
                reject(err);
            });
        });
    }
}
