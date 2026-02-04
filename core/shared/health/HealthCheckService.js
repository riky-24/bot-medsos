/**
 * HealthCheckService
 * Production-ready health check system
 * Implements liveness, readiness probes, and system metrics
 */
export class HealthCheckService {
  constructor() {
    this.checks = new Map();
    this.timeout = 5000; // 5s timeout per check
    this.cacheMs = 5000; // Cache results for 5s
    this.lastResult = null;
    this.lastCheckTime = 0;
    this.startTime = Date.now();
  }
  
  /**
   * Register a health check
   * @param {string} name - Check name
   * @param {Function} checkFn - Async function returning { status, ...details }
   * @param {boolean} critical - If false, failure won't affect overall health
   */
  register(name, checkFn, critical = true) {
    this.checks.set(name, { checkFn, critical });
  }
  
  /**
   * Run all health checks in parallel (with caching)
   */
  async runAll(forceRefresh = false) {
    // Return cached result if fresh
    if (!forceRefresh && this.lastResult && (Date.now() - this.lastCheckTime) < this.cacheMs) {
      return this.lastResult;
    }
    
    const results = {};
    const promises = [];
    
    for (const [name, { checkFn, critical }] of this.checks) {
      promises.push(this.runSingleCheck(name, checkFn, critical));
    }
    
    const checkResults = await Promise.all(promises);
    checkResults.forEach(({ name, result, latency }) => {
      results[name] = { ...result, latency };
    });
    
    const isHealthy = this.evaluateOverallHealth(results);
    const metrics = this.getSystemMetrics();
    
    this.lastResult = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      checks: results,
      metrics,
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
    this.lastCheckTime = Date.now();
    
    return this.lastResult;
  }
  
  /**
   * Run single check with timeout and latency tracking
   * @private
   */
  async runSingleCheck(name, checkFn, critical) {
    const start = Date.now();
    try {
      const result = await Promise.race([
        checkFn(),
        this.timeoutPromise()
      ]);
      const latency = Date.now() - start;
      return {
        name,
        result: { ...result, critical },
        latency: `${latency}ms`
      };
    } catch (error) {
      const latency = Date.now() - start;
      return {
        name,
        result: {
          status: 'unhealthy',
          error: error.message,
          critical
        },
        latency: `${latency}ms`
      };
    }
  }
  
  /**
   * Timeout promise
   * @private
   */
  timeoutPromise() {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Health check timeout')), this.timeout)
    );
  }
  
  /**
   * Evaluate overall health based on critical checks
   * @private
   */
  evaluateOverallHealth(results) {
    for (const check of Object.values(results)) {
      if (check.critical && check.status !== 'healthy') {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Get system metrics (memory, CPU)
   */
  getSystemMetrics() {
    const memUsage = process.memoryUsage();
    return {
      memory: {
        heapUsed: this.formatBytes(memUsage.heapUsed),
        heapTotal: this.formatBytes(memUsage.heapTotal),
        rss: this.formatBytes(memUsage.rss),
        external: this.formatBytes(memUsage.external)
      },
      uptime: `${Math.floor(process.uptime())}s`,
      nodeVersion: process.version,
      platform: process.platform
    };
  }
  
  /**
   * Format bytes to human readable
   * @private
   */
  formatBytes(bytes) {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)}MB`;
  }
  
  /**
   * Get liveness status (just check process is alive)
   */
  getLiveness() {
    return {
      status: 'alive',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Get readiness status (check if app is ready to receive traffic)
   */
  async getReadiness() {
    const health = await this.runAll();
    return {
      status: health.status === 'healthy' ? 'ready' : 'not_ready',
      checks: Object.keys(health.checks).length,
      healthy: Object.values(health.checks).filter(c => c.status === 'healthy').length,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Quick summary for logging
   */
  async getSummary() {
    const health = await this.runAll();
    const failedChecks = Object.entries(health.checks)
      .filter(([_, v]) => v.status !== 'healthy')
      .map(([k, _]) => k);
    
    return {
      status: health.status,
      uptime: health.uptime.toFixed(0) + 's',
      memory: health.metrics.memory.heapUsed,
      failed: failedChecks.length > 0 ? failedChecks : null
    };
  }
}
