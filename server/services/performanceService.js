const redis = require('redis');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class PerformanceService {
  constructor() {
    this.redisClient = null;
    this.memoryCache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0
    };
    this.compressionEnabled = true;
    this.analyticsEnabled = true;
  }

  // Initialize Redis connection
  async initialize() {
    try {
      if (process.env.REDIS_URL) {
        this.redisClient = redis.createClient({
          url: process.env.REDIS_URL,
          retry_strategy: (options) => {
            if (options.error && options.error.code === 'ECONNREFUSED') {
              return new Error('Redis server refused connection');
            }
            if (options.total_retry_time > 1000 * 60 * 60) {
              return new Error('Retry time exhausted');
            }
            if (options.attempt > 10) {
              return undefined;
            }
            return Math.min(options.attempt * 100, 3000);
          }
        });

        this.redisClient.on('error', (err) => {
          console.error('Redis Client Error:', err);
        });

        await this.redisClient.connect();
        console.log('Redis cache initialized successfully');
      } else {
        console.log('Redis URL not provided, using in-memory cache only');
      }
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      this.redisClient = null;
    }
  }

  // Multi-layer caching system
  async get(key, options = {}) {
    const { 
      layers = ['memory', 'redis', 'database'], 
      ttl = 3600,
      compress = true 
    } = options;

    const cacheKey = this.generateCacheKey(key);
    
    try {
      // Layer 1: Memory cache (fastest)
      if (layers.includes('memory')) {
        const memoryResult = this.getFromMemory(cacheKey);
        if (memoryResult) {
          this.cacheStats.hits++;
          return this.decompressIfNeeded(memoryResult, compress);
        }
      }

      // Layer 2: Redis cache (fast)
      if (layers.includes('redis') && this.redisClient) {
        const redisResult = await this.getFromRedis(cacheKey);
        if (redisResult) {
          // Promote to memory cache
          this.saveToMemory(cacheKey, redisResult, ttl);
          this.cacheStats.hits++;
          return this.decompressIfNeeded(redisResult, compress);
        }
      }

      // Layer 3: Database or external source (slowest)
      if (layers.includes('database')) {
        const dbResult = await this.getFromDatabase(key);
        if (dbResult) {
          // Store in all layers
          await this.set(key, dbResult, { ttl, compress });
          this.cacheStats.hits++;
          return dbResult;
        }
      }

      this.cacheStats.misses++;
      return null;

    } catch (error) {
      console.error('Cache get error:', error);
      this.cacheStats.misses++;
      return null;
    }
  }

  // Set data in multi-layer cache
  async set(key, value, options = {}) {
    const { 
      ttl = 3600, 
      layers = ['memory', 'redis', 'database'],
      compress = true 
    } = options;

    const cacheKey = this.generateCacheKey(key);
    const compressedValue = this.compressIfNeeded(value, compress);

    try {
      // Store in all specified layers
      const promises = [];

      if (layers.includes('memory')) {
        promises.push(this.saveToMemory(cacheKey, compressedValue, ttl));
      }

      if (layers.includes('redis') && this.redisClient) {
        promises.push(this.saveToRedis(cacheKey, compressedValue, ttl));
      }

      if (layers.includes('database')) {
        promises.push(this.saveToDatabase(key, value, ttl));
      }

      await Promise.allSettled(promises);
      this.cacheStats.size++;

      return true;

    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  // Smart cache invalidation
  async invalidate(pattern, scope = 'all') {
    try {
      const promises = [];
      const invalidated = [];

      if (scope.includes('memory') || scope === 'all') {
        const memoryKeys = Array.from(this.memoryCache.keys());
        const matchingMemoryKeys = memoryKeys.filter(key => 
          this.patternMatch(key, pattern)
        );
        
        matchingMemoryKeys.forEach(key => {
          this.memoryCache.delete(key);
          invalidated.push(`memory:${key}`);
        });
      }

      if (scope.includes('redis') && this.redisClient) {
        const redisKeys = await this.redisClient.keys(`*${pattern}*`);
        if (redisKeys.length > 0) {
          await this.redisClient.del(redisKeys);
          invalidated.push(...redisKeys.map(key => `redis:${key}`));
        }
      }

      if (scope.includes('database') || scope === 'all') {
        const dbResult = await this.invalidateFromDatabase(pattern);
        invalidated.push(...dbResult);
      }

      console.log(`Cache invalidation: ${invalidated.length} keys invalidated for pattern: ${pattern}`);
      return { invalidated, count: invalidated.length };

    } catch (error) {
      console.error('Cache invalidation error:', error);
      return { invalidated: [], count: 0, error: error.message };
    }
  }

  // Predictive caching
  async predictiveCache(userId, context) {
    try {
      const predictions = await this.generateCachePredictions(userId, context);
      const results = [];

      for (const prediction of predictions) {
        const { key, data, probability, ttl } = prediction;
        
        if (probability > 0.7) { // High confidence predictions
          await this.set(key, data, { 
            ttl: ttl || 1800, // 30 minutes
            layers: ['memory', 'redis']
          });
          results.push({ key, probability, cached: true });
        }
      }

      return results;

    } catch (error) {
      console.error('Predictive caching error:', error);
      return [];
    }
  }

  // AI API Response Caching
  async cacheAIResponse(request, response, ttl = 1800) {
    const cacheKey = this.generateAICacheKey(request);
    
    const cacheData = {
      response,
      timestamp: new Date().toISOString(),
      requestHash: this.hashRequest(request),
      confidence: response.metadata?.confidence || 0.8
    };

    return this.set(`ai:${cacheKey}`, cacheData, { ttl });
  }

  // Check for cached AI response
  async getCachedAIResponse(request) {
    const cacheKey = this.generateAICacheKey(request);
    const cached = await this.get(`ai:${cacheKey}`, { ttl: 3600 });
    
    if (cached && this.isCacheValid(cached, request)) {
      return {
        ...cached.response,
        cached: true,
        cacheAge: Date.now() - new Date(cached.timestamp).getTime()
      };
    }

    return null;
  }

  // 3D Model Caching with optimization
  async cache3DModel(modelId, modelData, options = {}) {
    const { optimize = true, levels = 3 } = options;
    
    let cachedData = {
      original: modelData,
      optimized: null,
      thumbnails: {},
      metadata: {
        modelId,
        createdAt: new Date().toISOString(),
        size: JSON.stringify(modelData).length,
        format: modelData.format || 'glb'
      }
    };

    if (optimize) {
      // Generate optimized versions
      cachedData.optimized = await this.optimize3DModel(modelData, levels);
      cachedData.thumbnails = await this.generate3DThumbnails(modelData);
    }

    const ttl = 86400; // 24 hours
    return this.set(`3d:${modelId}`, cachedData, { 
      ttl, 
      compress: true,
      layers: ['memory', 'redis']
    });
  }

  // Performance monitoring and analytics
  async getPerformanceMetrics() {
    const metrics = {
      cache: {
        hits: this.cacheStats.hits,
        misses: this.cacheStats.misses,
        hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0,
        size: this.cacheStats.size,
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external
        }
      },
      redis: this.redisClient ? await this.getRedisMetrics() : null,
      api: await this.getAPIMetrics(),
      database: await this.getDatabaseMetrics(),
      system: {
        uptime: process.uptime(),
        cpu: process.cpuUsage(),
        load: process.loadavg()
      }
    };

    return metrics;
  }

  // Cache warming strategies
  async warmupCache() {
    try {
      console.log('Starting cache warmup...');
      
      // Warmup frequent queries
      await this.warmupFrequentQueries();
      
      // Warmup AI responses
      await this.warmupAIResponses();
      
      // Warmup 3D models
      await this.warmup3DModels();
      
      console.log('Cache warmup completed');
      return { success: true, warmedAt: new Date().toISOString() };

    } catch (error) {
      console.error('Cache warmup error:', error);
      return { success: false, error: error.message };
    }
  }

  // Helper Methods

  generateCacheKey(key) {
    if (typeof key === 'string') return `cache:${key}`;
    return `cache:${crypto.createHash('md5').update(JSON.stringify(key)).digest('hex')}`;
  }

  generateAICacheKey(request) {
    const normalizedRequest = {
      prompt: request.prompt || request.content,
      model: request.model || 'gpt-3.5-turbo',
      parameters: {
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 150
      }
    };

    return crypto.createHash('sha256')
      .update(JSON.stringify(normalizedRequest))
      .digest('hex');
  }

  hashRequest(request) {
    return crypto.createHash('md5')
      .update(JSON.stringify(request))
      .digest('hex');
  }

  // Memory cache operations
  getFromMemory(key) {
    const item = this.memoryCache.get(key);
    if (!item) return null;

    if (item.expires && new Date() > item.expires) {
      this.memoryCache.delete(key);
      return null;
    }

    return item.data;
  }

  saveToMemory(key, data, ttl) {
    const expires = ttl ? new Date(Date.now() + ttl * 1000) : null;
    this.memoryCache.set(key, { data, expires });
    
    // Cleanup if cache is too large
    if (this.memoryCache.size > 10000) {
      this.cleanupMemoryCache();
    }
  }

  cleanupMemoryCache() {
    const now = new Date();
    let cleaned = 0;
    
    for (const [key, item] of this.memoryCache.entries()) {
      if (!item.expires || now > item.expires) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }
    
    this.cacheStats.evictions += cleaned;
    console.log(`Memory cache cleanup: ${cleaned} items removed`);
  }

  // Redis operations
  async getFromRedis(key) {
    try {
      const data = await this.redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async saveToRedis(key, data, ttl) {
    try {
      const serialized = JSON.stringify(data);
      if (ttl) {
        await this.redisClient.setEx(key, ttl, serialized);
      } else {
        await this.redisClient.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  }

  // Database operations (placeholder)
  async getFromDatabase(key) {
    // This would implement database queries
    // For now, return null
    return null;
  }

  async saveToDatabase(key, data, ttl) {
    // This would implement database storage
    // For now, return true
    return true;
  }

  async invalidateFromDatabase(pattern) {
    // This would implement database cache invalidation
    return [];
  }

  // Compression utilities
  compressIfNeeded(data, compress) {
    if (!compress || !this.compressionEnabled) return data;
    
    try {
      const jsonString = JSON.stringify(data);
      const compressed = require('zlib').gzipSync(jsonString);
      return {
        _compressed: true,
        _data: compressed.toString('base64')
      };
    } catch (error) {
      console.error('Compression error:', error);
      return data;
    }
  }

  decompressIfNeeded(data, compress) {
    if (!data || !data._compressed) return data;
    
    try {
      const compressed = Buffer.from(data._data, 'base64');
      const decompressed = require('zlib').gunzipSync(compressed);
      return JSON.parse(decompressed.toString());
    } catch (error) {
      console.error('Decompression error:', error);
      return data;
    }
  }

  // Pattern matching for cache invalidation
  patternMatch(key, pattern) {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(key);
    }
    return key.includes(pattern);
  }

  // Cache validation
  isCacheValid(cachedData, request) {
    const age = Date.now() - new Date(cachedData.timestamp).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    return age < maxAge && cachedData.confidence > 0.7;
  }

  // 3D Model optimization
  async optimize3DModel(modelData, levels) {
    const optimized = {
      high: modelData, // Original
      medium: this.reducePolygonCount(modelData, 0.7),
      low: this.reducePolygonCount(modelData, 0.4)
    };
    
    return optimized;
  }

  reducePolygonCount(modelData, factor) {
    // Simple polygon reduction simulation
    return {
      ...modelData,
      vertices: Math.floor(modelData.vertices.length * factor),
      faces: Math.floor(modelData.faces.length * factor)
    };
  }

  async generate3DThumbnails(modelData) {
    // Simulate thumbnail generation
    return {
      small: { url: '/thumbnails/small.png', size: [128, 128] },
      medium: { url: '/thumbnails/medium.png', size: [256, 256] },
      large: { url: '/thumbnails/large.png', size: [512, 512] }
    };
  }

  // Predictive analytics
  async generateCachePredictions(userId, context) {
    // Analyze user patterns and predict what they'll need
    const predictions = [];
    
    // Common 3D model requests
    const commonModels = ['cube', 'sphere', 'cylinder', 'house', 'car'];
    
    for (const model of commonModels) {
      predictions.push({
        key: `3d:${model}`,
        data: { type: 'prediction', model },
        probability: 0.8,
        ttl: 1800
      });
    }
    
    return predictions;
  }

  // Warmup strategies
  async warmupFrequentQueries() {
    const frequentQueries = [
      'user:profile:default',
      'settings:default',
      'help:faq'
    ];
    
    for (const query of frequentQueries) {
      // Simulate warming up these queries
      await this.set(query, { warmed: true, timestamp: new Date() }, { ttl: 3600 });
    }
  }

  async warmupAIResponses() {
    const commonPrompts = [
      'Hello, how are you?',
      'Create a 3D model of a house',
      'Explain AI to me'
    ];
    
    for (const prompt of commonPrompts) {
      const cached = await this.getCachedAIResponse({ prompt });
      if (!cached) {
        // Simulate having these responses ready
        await this.cacheAIResponse({ prompt }, { 
          response: `Cached response for: ${prompt}`,
          cached: true 
        });
      }
    }
  }

  async warmup3DModels() {
    const commonModels = ['cube', 'sphere', 'cylinder'];
    
    for (const modelType of commonModels) {
      const modelId = `common:${modelType}`;
      const modelData = { type: modelType, warmed: true };
      await this.cache3DModel(modelId, modelData, { optimize: false });
    }
  }

  // Metrics collection
  async getRedisMetrics() {
    if (!this.redisClient) return null;
    
    try {
      const info = await this.redisClient.info('memory');
      const dbSize = await this.redisClient.dbSize();
      
      return {
        connected: true,
        dbSize,
        memory: this.parseRedisInfo(info)
      };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }

  parseRedisInfo(info) {
    const lines = info.split('\n');
    const memory = {};
    
    for (const line of lines) {
      if (line.startsWith('used_memory_human:')) {
        memory.used = line.split(':')[1].trim();
      } else if (line.startsWith('used_memory_peak_human:')) {
        memory.peak = line.split(':')[1].trim();
      }
    }
    
    return memory;
  }

  async getAPIMetrics() {
    return {
      requestsPerMinute: 0, // Would be collected from middleware
      averageResponseTime: 0,
      errorRate: 0
    };
  }

  async getDatabaseMetrics() {
    return {
      connectionCount: 0,
      queryTime: 0,
      cacheHitRate: 0
    };
  }

  // Cleanup and maintenance
  async performMaintenance() {
    try {
      console.log('Starting performance maintenance...');
      
      // Clean memory cache
      this.cleanupMemoryCache();
      
      // Clean old AI responses
      await this.cleanupOldAICache();
      
      // Clean expired 3D models
      await this.cleanupExpired3DModels();
      
      // Generate performance report
      const metrics = await this.getPerformanceMetrics();
      console.log('Performance maintenance completed:', metrics);
      
      return { success: true, metrics };

    } catch (error) {
      console.error('Performance maintenance error:', error);
      return { success: false, error: error.message };
    }
  }

  async cleanupOldAICache() {
    // Remove AI cache entries older than 7 days
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    if (this.redisClient) {
      const keys = await this.redisClient.keys('ai:*');
      for (const key of keys) {
        const data = await this.getFromRedis(key);
        if (data && new Date(data.timestamp) < cutoff) {
          await this.redisClient.del(key);
        }
      }
    }
  }

  async cleanupExpired3DModels() {
    // Remove 3D models older than 30 days
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    if (this.redisClient) {
      const keys = await this.redisClient.keys('3d:*');
      for (const key of keys) {
        const data = await this.getFromRedis(key);
        if (data && new Date(data.metadata.createdAt) < cutoff) {
          await this.redisClient.del(key);
        }
      }
    }
  }
}

module.exports = PerformanceService;