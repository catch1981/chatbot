const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class SecurityService {
  constructor() {
    this.encryptionKeys = new Map();
    this.sessionTokens = new Map();
    this.rateLimits = new Map();
    this.blockedUsers = new Set();
    this.suspiciousActivities = new Map();
  }

  // End-to-End Encryption (E2EE) Implementation
  generateKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    return { publicKey, privateKey };
  }

  async encryptMessage(message, recipientPublicKey) {
    try {
      // Generate a symmetric key for message encryption
      const symmetricKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);

      // Encrypt message with symmetric key (AES-256-GCM)
      const cipher = crypto.createCipher('aes-256-gcm', symmetricKey);
      let encrypted = cipher.update(message, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();

      // Encrypt symmetric key with recipient's public key
      const encryptedKey = crypto.publicEncrypt(recipientPublicKey, symmetricKey);

      return {
        encryptedMessage: encrypted,
        encryptedKey: encryptedKey.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        algorithm: 'AES-256-GCM'
      };
    } catch (error) {
      console.error('E2EE encryption error:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  async decryptMessage(encryptedData, privateKey) {
    try {
      const { encryptedMessage, encryptedKey, iv, authTag } = encryptedData;

      // Decrypt symmetric key with private key
      const symmetricKey = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
        },
        Buffer.from(encryptedKey, 'base64')
      );

      // Decrypt message with symmetric key
      const decipher = crypto.createDecipher('aes-256-gcm', symmetricKey);
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      let decrypted = decipher.update(encryptedMessage, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('E2EE decryption error:', error);
      throw new Error('Failed to decrypt message');
    }
  }

  // Advanced Content Moderation
  async moderateContent(content, context = {}) {
    const moderationChecks = {
      harmful: await this.checkForHarmfulContent(content),
      spam: await this.checkForSpam(content, context),
      inappropriate: await this.checkForInappropriateContent(content),
      aiPromptInjection: await this.checkPromptInjection(content),
      malicious: await this.checkForMaliciousContent(content)
    };

    const riskScore = this.calculateRiskScore(moderationChecks);
    
    return {
      approved: riskScore < 0.7,
      riskScore,
      checks: moderationChecks,
      action: this.determineAction(riskScore, moderationChecks)
    };
  }

  async checkForHarmfulContent(content) {
    // Simple keyword-based check (would use more sophisticated AI in production)
    const harmfulKeywords = ['kill', 'harm', 'violence', 'hate', 'terror'];
    const lowerContent = content.toLowerCase();
    
    const foundKeywords = harmfulKeywords.filter(keyword => 
      lowerContent.includes(keyword)
    );

    return {
      score: foundKeywords.length / harmfulKeywords.length,
      keywords: foundKeywords,
      flagged: foundKeywords.length > 0
    };
  }

  async checkForSpam(content, context) {
    // Check for repetitive patterns, excessive caps, etc.
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    const hasRepetitiveChars = /(.)\1{4,}/.test(content);
    const hasExcessivePunctuation = /[!?]{3,}/.test(content);

    const spamScore = (capsRatio > 0.8 ? 0.3 : 0) + 
                     (hasRepetitiveChars ? 0.4 : 0) + 
                     (hasExcessivePunctuation ? 0.3 : 0);

    return {
      score: spamScore,
      capsRatio,
      hasRepetitiveChars,
      hasExcessivePunctuation,
      flagged: spamScore > 0.5
    };
  }

  async checkForInappropriateContent(content) {
    // Check for adult content, profanity, etc.
    const inappropriatePatterns = [
      /\b(?:nsfw|explicit|adult)\b/i,
      /\b(?:sex|porn|xxx)\b/i
    ];

    const foundPatterns = inappropriatePatterns.filter(pattern => 
      pattern.test(content)
    );

    return {
      score: foundPatterns.length / inappropriatePatterns.length,
      patterns: foundPatterns,
      flagged: foundPatterns.length > 0
    };
  }

  async checkPromptInjection(content) {
    // Check for AI prompt injection attempts
    const injectionPatterns = [
      /ignore previous instructions/i,
      /forget everything/i,
      /act as if you are/i,
      /pretend you are/i,
      /new system prompt/i,
      /system: /i
    ];

    const foundInjections = injectionPatterns.filter(pattern => 
      pattern.test(content)
    );

    return {
      score: foundInjections.length / injectionPatterns.length,
      injections: foundInjections,
      flagged: foundInjections.length > 0
    };
  }

  async checkForMaliciousContent(content) {
    // Check for scripts, malicious links, etc.
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /eval\(/i,
      /on\w+\s*=/i
    ];

    const foundMalicious = maliciousPatterns.filter(pattern => 
      pattern.test(content)
    );

    return {
      score: foundMalicious.length / maliciousPatterns.length,
      malicious: foundMalicious,
      flagged: foundMalicious.length > 0
    };
  }

  calculateRiskScore(checks) {
    const weights = {
      harmful: 0.4,
      spam: 0.2,
      inappropriate: 0.3,
      aiPromptInjection: 0.05,
      malicious: 0.05
    };

    return Object.entries(checks).reduce((total, [key, check]) => {
      return total + (check.score * weights[key]);
    }, 0);
  }

  determineAction(riskScore, checks) {
    if (riskScore > 0.9) return 'block';
    if (riskScore > 0.7) return 'review';
    if (riskScore > 0.5) return 'flag';
    return 'allow';
  }

  // Enhanced Authentication
  async createSecureSession(userId, additionalData = {}) {
    const sessionId = uuidv4();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const session = {
      id: sessionId,
      userId,
      token,
      createdAt: new Date(),
      expiresAt,
      data: additionalData,
      lastActivity: new Date(),
      ipAddress: additionalData.ipAddress,
      userAgent: additionalData.userAgent
    };

    this.sessionTokens.set(token, session);
    return { sessionId, token, expiresAt };
  }

  async validateSession(token) {
    const session = this.sessionTokens.get(token);
    
    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }

    if (new Date() > session.expiresAt) {
      this.sessionTokens.delete(token);
      return { valid: false, reason: 'Session expired' };
    }

    // Update last activity
    session.lastActivity = new Date();
    this.sessionTokens.set(token, session);

    return { valid: true, session };
  }

  async revokeSession(token) {
    this.sessionTokens.delete(token);
  }

  // Rate Limiting
  checkRateLimit(identifier, endpoint, maxRequests = 100, windowMs = 15 * 60 * 1000) {
    const key = `${identifier}:${endpoint}`;
    const now = Date.now();
    
    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, {
        requests: [],
        blocked: false,
        blockUntil: null
      });
    }

    const limit = this.rateLimits.get(key);
    
    // Remove old requests outside the window
    limit.requests = limit.requests.filter(time => now - time < windowMs);
    
    // Check if currently blocked
    if (limit.blocked && now < limit.blockUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: limit.blockUntil,
        reason: 'Rate limit exceeded'
      };
    }

    // Reset block if expired
    if (limit.blocked && now >= limit.blockUntil) {
      limit.blocked = false;
      limit.blockUntil = null;
    }

    // Check current request count
    if (limit.requests.length >= maxRequests) {
      // Block for 1 hour
      limit.blocked = true;
      limit.blockUntil = now + 60 * 60 * 1000;
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: limit.blockUntil,
        reason: 'Rate limit exceeded - blocked for 1 hour'
      };
    }

    // Add current request
    limit.requests.push(now);
    
    return {
      allowed: true,
      remaining: maxRequests - limit.requests.length,
      resetTime: now + windowMs
    };
  }

  // Input Sanitization
  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/eval\(/gi, '') // Remove eval calls
      .replace(/script/gi, '') // Remove script references
      .trim();
  }

  // AI API Security
  async secureAIRequest(request, userId) {
    // Add security headers and validate request
    const sanitizedRequest = {
      ...request,
      content: this.sanitizeInput(request.content || request.prompt || '')
    };

    // Check for prompt injection in the request
    const injectionCheck = await this.checkPromptInjection(sanitizedRequest.content);
    if (injectionCheck.flagged) {
      throw new Error('Prompt injection detected');
    }

    // Add user context for monitoring
    sanitizedRequest.metadata = {
      ...sanitizedRequest.metadata,
      userId,
      timestamp: new Date().toISOString(),
      requestId: uuidv4()
    };

    return sanitizedRequest;
  }

  // Threat Detection
  async detectThreats(userId, activity) {
    const userActivities = this.suspiciousActivities.get(userId) || [];
    
    // Add current activity
    userActivities.push({
      ...activity,
      timestamp: new Date()
    });

    // Keep only recent activities (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    this.suspiciousActivities.set(
      userId,
      userActivities.filter(a => a.timestamp > oneHourAgo)
    );

    // Analyze patterns for threats
    const threats = this.analyzeThreatPatterns(userId);
    
    if (threats.length > 0) {
      await this.handleThreatDetection(userId, threats);
    }

    return threats;
  }

  analyzeThreatPatterns(userId) {
    const activities = this.suspiciousActivities.get(userId) || [];
    const threats = [];

    // Check for rapid-fire requests (potential bot)
    const recentRequests = activities.filter(a => 
      a.type === 'api_request' && 
      new Date() - a.timestamp < 60000
    );

    if (recentRequests.length > 50) {
      threats.push({
        type: 'rapid_requests',
        severity: 'high',
        description: 'Excessive API requests detected'
      });
    }

    // Check for failed authentication attempts
    const failedAuths = activities.filter(a => 
      a.type === 'auth_failed' && 
      new Date() - a.timestamp < 300000
    );

    if (failedAuths.length > 5) {
      threats.push({
        type: 'brute_force',
        severity: 'critical',
        description: 'Multiple failed authentication attempts'
      });
    }

    return threats;
  }

  async handleThreatDetection(userId, threats) {
    const criticalThreats = threats.filter(t => t.severity === 'critical');
    
    if (criticalThreats.length > 0) {
      // Block user temporarily
      this.blockedUsers.add(userId);
      
      // Schedule unblock
      setTimeout(() => {
        this.blockedUsers.delete(userId);
      }, 60 * 60 * 1000); // Unblock after 1 hour
      
      console.log(`User ${userId} blocked due to threats:`, criticalThreats);
    }

    // Log all threats for analysis
    console.log(`Threats detected for user ${userId}:`, threats);
  }

  // Secure token generation for API keys
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Hash sensitive data
  hashData(data, salt = null) {
    const actualSalt = salt || crypto.randomBytes(16);
    const hash = crypto.pbkdf2Sync(data, actualSalt, 100000, 64, 'sha512');
    return {
      hash: hash.toString('hex'),
      salt: actualSalt.toString('hex')
    };
  }

  // Verify hashed data
  verifyHash(data, hash, salt) {
    const testHash = crypto.pbkdf2Sync(data, Buffer.from(salt, 'hex'), 100000, 64, 'sha512');
    return testHash.toString('hex') === hash;
  }

  // Cleanup expired sessions
  cleanupExpiredSessions() {
    const now = new Date();
    let cleaned = 0;

    for (const [token, session] of this.sessionTokens.entries()) {
      if (now > session.expiresAt) {
        this.sessionTokens.delete(token);
        cleaned++;
      }
    }

    console.log(`Cleaned up ${cleaned} expired sessions`);
  }
}

module.exports = SecurityService;