const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class ContentModerationService extends EventEmitter {
  constructor() {
    super();
    this.moderationQueue = new Map();
    this.safetyRules = this.initializeSafetyRules();
    this.contentHistory = new Map();
    this.moderationStats = {
      totalChecks: 0,
      flaggedContent: 0,
      rejectedContent: 0,
      processedItems: 0
    };
    this.auditLog = [];
    
    // Initialize AI moderation models (would integrate with actual services)
    this.moderationModels = {
      ageDetection: { confidence: 0.95, enabled: true },
      animalDetection: { confidence: 0.98, enabled: true },
      contentSafety: { confidence: 0.92, enabled: true },
      nsfwDetection: { confidence: 0.96, enabled: true }
    };
  }

  // Initialize safety and moderation rules
  initializeSafetyRules() {
    return {
      ageVerification: {
        required: true,
        minimumAge: 21,
        detectionMethods: ['facial_analysis', 'document_verification', 'age_estimation'],
        confidenceThreshold: 0.90,
        allowSelfie: true,
        allowID: true,
        requireManualReview: false
      },
      contentRestrictions: {
        prohibitedContent: [
          'nudity',
          'sexual_content',
          'violence',
          'hate_speech',
          'harassment',
          'illegal_activities',
          'harmful_substances',
          'animal_content'
        ],
        animalPolicy: {
          allowed: false,
          detectionRequired: true,
          immediateRejection: true,
          reportRequired: true
        },
        automatedModeration: {
          enabled: true,
          immediateRejectionThreshold: 0.85,
          manualReviewThreshold: 0.70,
          batchProcessing: true
        }
      },
      userBehavior: {
        trackPatternAnalysis: true,
        detectAbuse: true,
        rateLimiting: {
          uploadsPerHour: 10,
          uploadsPerDay: 50,
          maxFileSize: 10 * 1024 * 1024, // 10MB
          allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif']
        }
      }
    };
  }

  // Comprehensive content moderation check
  async moderateContent(contentData) {
    const moderationId = uuidv4();
    const startTime = Date.now();
    
    const moderation = {
      id: moderationId,
      userId: contentData.userId,
      contentType: contentData.type, // 'image', '3d_model', 'text', 'voice'
      contentData: contentData,
      status: 'pending',
      results: {},
      violations: [],
      timestamp: new Date(),
      processingTime: 0
    };

    this.moderationQueue.set(moderationId, moderation);
    this.moderationStats.totalChecks++;

    try {
      // Step 1: Age verification (if applicable)
      if (this.requiresAgeVerification(contentData)) {
        const ageCheck = await this.verifyAge(contentData);
        moderation.results.ageVerification = ageCheck;
        
        if (!ageCheck.passed) {
          moderation.violations.push({
            type: 'age_verification_failed',
            reason: ageCheck.reason,
            severity: 'critical'
          });
        }
      }

      // Step 2: Content safety analysis
      const safetyCheck = await this.analyzeContentSafety(contentData);
      moderation.results.safetyAnalysis = safetyCheck;

      // Step 3: Animal content detection
      if (contentData.type === 'image' || contentData.type === '3d_model') {
        const animalCheck = await this.detectAnimalContent(contentData);
        moderation.results.animalDetection = animalCheck;
        
        if (animalCheck.animalsDetected) {
          moderation.violations.push({
            type: 'animal_content_prohibited',
            reason: `Detected animals: ${animalCheck.animals.join(', ')}`,
            severity: 'critical'
          });
        }
      }

      // Step 4: Content type specific checks
      const typeSpecificCheck = await this.performTypeSpecificChecks(contentData);
      moderation.results.typeSpecific = typeSpecificCheck;

      // Step 5: Pattern and behavior analysis
      const behaviorCheck = await this.analyzeUserBehavior(contentData.userId, contentData);
      moderation.results.behaviorAnalysis = behaviorCheck;

      // Step 6: Determine final decision
      const decision = this.makeModerationDecision(moderation);
      moderation.status = decision.status;
      moderation.decision = decision;

      // Step 7: Update statistics
      this.updateStatistics(moderation);

      // Step 8: Log to audit trail
      this.logModerationDecision(moderation);

      moderation.processingTime = Date.now() - startTime;
      this.moderationQueue.set(moderationId, moderation);

      // Emit event
      this.emit('contentModerated', { moderationId, moderation, decision });

      return {
        moderationId,
        status: moderation.status,
        decision: decision,
        results: moderation.results,
        violations: moderation.violations,
        processingTime: moderation.processingTime
      };

    } catch (error) {
      console.error('Content moderation error:', error);
      
      moderation.status = 'error';
      moderation.error = error.message;
      moderation.processingTime = Date.now() - startTime;
      
      this.moderationQueue.set(moderationId, moderation);
      this.emit('moderationError', { moderationId, error });
      
      throw error;
    }
  }

  // Age verification system
  async verifyAge(contentData) {
    if (!this.safetyRules.ageVerification.required) {
      return { passed: true, method: 'not_required', confidence: 1.0 };
    }

    try {
      // Simulate AI age detection (in production, would use actual services)
      const detectionResults = await this.performAgeDetection(contentData);
      
      const ageCheck = {
        passed: false,
        estimatedAge: null,
        confidence: 0,
        method: detectionResults.method,
        details: detectionResults.details
      };

      // Check if age verification passes
      if (detectionResults.estimatedAge >= this.safetyRules.ageVerification.minimumAge) {
        ageCheck.passed = true;
        ageCheck.estimatedAge = detectionResults.estimatedAge;
        ageCheck.confidence = detectionResults.confidence;
      } else {
        ageCheck.reason = `Estimated age (${detectionResults.estimatedAge}) below minimum requirement (${this.safetyRules.ageVerification.minimumAge})`;
      }

      return ageCheck;
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        method: 'detection_failed'
      };
    }
  }

  // Perform age detection
  async performAgeDetection(contentData) {
    // In production, this would integrate with:
    // - Face++ API for facial analysis
    // - AWS Rekognition for age estimation
    // - Azure Face API for demographic analysis
    // - Custom ML models for age detection

    const methods = [
      'facial_analysis',
      'document_verification', 
      'age_estimation',
      'behavioral_analysis'
    ];

    // Simulate detection results
    const mockResults = {
      facial_analysis: {
        estimatedAge: Math.floor(Math.random() * 30) + 18, // 18-48
        confidence: 0.85 + Math.random() * 0.14,
        facesDetected: Math.random() > 0.2 ? 1 : 0,
        imageQuality: 0.7 + Math.random() * 0.3
      },
      document_verification: {
        estimatedAge: Math.floor(Math.random() * 30) + 18,
        confidence: 0.95,
        documentType: 'passport',
        verificationStatus: 'verified'
      },
      age_estimation: {
        estimatedAge: Math.floor(Math.random() * 30) + 18,
        confidence: 0.80 + Math.random() * 0.15,
        method: 'deep_learning'
      },
      behavioral_analysis: {
        estimatedAge: Math.floor(Math.random() * 30) + 18,
        confidence: 0.75,
        behaviorScore: 0.6 + Math.random() * 0.4
      }
    };

    // Choose primary method based on content type
    let primaryMethod = 'facial_analysis';
    if (contentData.type === 'document') {
      primaryMethod = 'document_verification';
    }

    const primaryResult = mockResults[primaryMethod];
    
    return {
      method: primaryMethod,
      estimatedAge: primaryResult.estimatedAge,
      confidence: primaryResult.confidence,
      details: primaryResult
    };
  }

  // Animal content detection
  async detectAnimalContent(contentData) {
    const detection = {
      animalsDetected: false,
      animals: [],
      confidence: 0,
      boundingBoxes: [],
      method: 'ai_detection'
    };

    try {
      // In production, this would use:
      // - YOLO object detection models
      // - Google Vision API for label detection
      // - Custom animal classification models
      // - AWS Rekognition for object and scene detection

      const animalClasses = [
        'dog', 'cat', 'bird', 'horse', 'sheep', 'cow', 'pig', 'chicken',
        'rabbit', 'hamster', 'guinea_pig', 'fish', 'reptile', 'amphibian',
        'insect', 'spider', 'wild_animal', 'exotic_pet'
      ];

      // Simulate detection (in production, run actual AI model)
      const detectionResults = await this.performAnimalDetection(contentData);
      
      detection.animalsDetected = detectionResults.animalsDetected;
      detection.animals = detectionResults.animals;
      detection.confidence = detectionResults.confidence;
      detection.boundingBoxes = detectionResults.boundingBoxes;

      return detection;
    } catch (error) {
      console.error('Animal detection error:', error);
      return {
        animalsDetected: false,
        error: error.message,
        confidence: 0
      };
    }
  }

  // Perform actual animal detection
  async performAnimalDetection(contentData) {
    // Mock detection results
    // In production, this would analyze the actual image/3D model
    
    const animalDetected = Math.random() > 0.95; // 5% chance of detecting animals
    
    if (animalDetected) {
      const possibleAnimals = ['dog', 'cat', 'bird', 'hamster'];
      const detectedAnimal = possibleAnimals[Math.floor(Math.random() * possibleAnimals.length)];
      
      return {
        animalsDetected: true,
        animals: [detectedAnimal],
        confidence: 0.90 + Math.random() * 0.09,
        boundingBoxes: [{
          x: Math.random() * 400,
          y: Math.random() * 300,
          width: 50 + Math.random() * 100,
          height: 50 + Math.random() * 100,
          label: detectedAnimal,
          confidence: 0.90 + Math.random() * 0.09
        }]
      };
    }

    return {
      animalsDetected: false,
      animals: [],
      confidence: 0.95,
      boundingBoxes: []
    };
  }

  // Content safety analysis
  async analyzeContentSafety(contentData) {
    const safetyAnalysis = {
      nsfw: false,
      violence: false,
      hateSpeech: false,
      inappropriate: false,
      confidence: 0,
      categories: [],
      riskScore: 0
    };

    try {
      // Simulate safety analysis
      // In production, would use:
      // - OpenAI Moderation API
      // - Google Cloud Vision API
      // - AWS Rekognition for content moderation
      // - Custom safety models

      const safetyResults = await this.performSafetyAnalysis(contentData);
      
      Object.assign(safetyAnalysis, safetyResults);
      safetyAnalysis.riskScore = this.calculateRiskScore(safetyAnalysis);
      
      return safetyAnalysis;
    } catch (error) {
      console.error('Safety analysis error:', error);
      return {
        nsfw: false,
        violence: false,
        hateSpeech: false,
        inappropriate: true,
        error: error.message,
        confidence: 0
      };
    }
  }

  // Perform safety analysis
  async performSafetyAnalysis(contentData) {
    // Mock safety analysis results
    const isInappropriate = Math.random() > 0.97; // 3% chance of inappropriate content
    
    if (isInappropriate) {
      const categories = ['nsfw', 'violence', 'hate_speech'];
      const category = categories[Math.floor(Math.random() * categories.length)];
      
      return {
        nsfw: category === 'nsfw',
        violence: category === 'violence',
        hateSpeech: category === 'hate_speech',
        inappropriate: true,
        confidence: 0.85 + Math.random() * 0.14,
        categories: [category],
        riskScore: 0.8 + Math.random() * 0.2
      };
    }

    return {
      nsfw: false,
      violence: false,
      hateSpeech: false,
      inappropriate: false,
      confidence: 0.95,
      categories: ['safe'],
      riskScore: 0.1
    };
  }

  // Type-specific content checks
  async performTypeSpecificChecks(contentData) {
    const typeChecks = {
      image: () => this.checkImageContent(contentData),
      '3d_model': () => this.check3DModelContent(contentData),
      text: () => this.checkTextContent(contentData),
      voice: () => this.checkVoiceContent(contentData)
    };

    const checkFunction = typeChecks[contentData.type];
    if (checkFunction) {
      return await checkFunction();
    }

    return { passed: true, details: 'No specific checks for this content type' };
  }

  // Image content checks
  async checkImageContent(contentData) {
    return {
      passed: true,
      details: {
        fileSize: contentData.size || 0,
        format: contentData.format || 'unknown',
        dimensions: contentData.dimensions || { width: 0, height: 0 },
        quality: 0.8 + Math.random() * 0.2,
        metadata: contentData.metadata || {}
      }
    };
  }

  // 3D model content checks
  async check3DModelContent(contentData) {
    return {
      passed: true,
      details: {
        fileSize: contentData.size || 0,
        format: contentData.format || 'unknown',
        vertices: contentData.vertices || 0,
        faces: contentData.faces || 0,
        materials: contentData.materials || 0,
        complexity: 'medium'
      }
    };
  }

  // Text content checks
  async checkTextContent(contentData) {
    const text = contentData.text || '';
    const checks = {
      length: text.length <= 10000,
      language: this.detectLanguage(text),
      sentiment: this.analyzeSentiment(text),
      profanity: this.checkProfanity(text)
    };

    return {
      passed: checks.length && !checks.profanity,
      details: checks
    };
  }

  // Voice content checks
  async checkVoiceContent(contentData) {
    return {
      passed: true,
      details: {
        duration: contentData.duration || 0,
        format: contentData.format || 'unknown',
        language: this.detectLanguage(contentData.transcript || ''),
        sentiment: this.analyzeSentiment(contentData.transcript || '')
      }
    };
  }

  // User behavior analysis
  async analyzeUserBehavior(userId, contentData) {
    // Check user's upload history and patterns
    const userHistory = this.contentHistory.get(userId) || [];
    const recentUploads = userHistory.filter(item => 
      Date.now() - item.timestamp < 24 * 60 * 60 * 1000
    );

    const behaviorCheck = {
      suspiciousActivity: false,
      uploadPattern: 'normal',
      frequency: recentUploads.length,
      previousViolations: userHistory.filter(item => item.violations.length > 0).length,
      riskScore: 0
    };

    // Analyze patterns
    if (recentUploads.length > this.safetyRules.userBehavior.rateLimiting.uploadsPerDay) {
      behaviorCheck.suspiciousActivity = true;
      behaviorCheck.riskScore += 0.3;
    }

    if (behaviorCheck.previousViolations > 3) {
      behaviorCheck.suspiciousActivity = true;
      behaviorCheck.riskScore += 0.4;
    }

    // Time-based analysis
    const hour = new Date().getHours();
    if (hour < 6 || hour > 23) {
      behaviorCheck.uploadPattern = 'unusual_time';
      behaviorCheck.riskScore += 0.1;
    }

    return behaviorCheck;
  }

  // Make final moderation decision
  makeModerationDecision(moderation) {
    const violations = moderation.violations;
    const results = moderation.results;

    // Critical violations requiring immediate rejection
    const criticalViolations = violations.filter(v => v.severity === 'critical');
    
    if (criticalViolations.length > 0) {
      return {
        status: 'rejected',
        reason: 'critical_violations',
        action: 'reject',
        message: 'Content rejected due to critical safety violations',
        details: criticalViolations
      };
    }

    // Age verification failures
    if (results.ageVerification && !results.ageVerification.passed) {
      return {
        status: 'rejected',
        reason: 'age_verification_failed',
        action: 'reject',
        message: 'Age verification failed - must be 21 or older',
        details: results.ageVerification
      };
    }

    // Animal content detection
    if (results.animalDetection && results.animalDetection.animalsDetected) {
      return {
        status: 'rejected',
        reason: 'animal_content_prohibited',
        action: 'reject',
        message: 'Animal content is not permitted on this platform',
        details: results.animalDetection
      };
    }

    // High risk content
    if (results.safetyAnalysis && results.safetyAnalysis.riskScore > 0.7) {
      return {
        status: 'flagged',
        reason: 'high_risk_content',
        action: 'manual_review',
        message: 'Content requires manual review due to safety concerns',
        details: results.safetyAnalysis
      };
    }

    // Behavior analysis flags
    if (results.behaviorAnalysis && results.behaviorAnalysis.suspiciousActivity) {
      return {
        status: 'flagged',
        reason: 'suspicious_user_behavior',
        action: 'manual_review',
        message: 'User behavior patterns require review',
        details: results.behaviorAnalysis
      };
    }

    // Low confidence detection
    if (this.hasLowConfidenceResults(results)) {
      return {
        status: 'flagged',
        reason: 'low_confidence_detection',
        action: 'manual_review',
        message: 'Automated detection confidence too low, manual review required',
        details: this.getLowConfidenceDetails(results)
      };
    }

    // Content approved
    return {
      status: 'approved',
      reason: 'all_checks_passed',
      action: 'approve',
      message: 'Content approved by automated moderation',
      details: {
        confidence: this.calculateOverallConfidence(results),
        riskScore: this.calculateOverallRiskScore(results)
      }
    };
  }

  // Check if content requires age verification
  requiresAgeVerification(contentData) {
    // Age verification required for:
    // - Profile pictures
    // - User-generated content
    // - Avatar uploads
    // - Any content with facial features
    
    const ageRequiredTypes = ['image', 'profile_picture', 'avatar'];
    return ageRequiredTypes.includes(contentData.type) || 
           contentData.requiresAgeVerification === true;
  }

  // Update moderation statistics
  updateStatistics(moderation) {
    this.moderationStats.processedItems++;
    
    if (moderation.violations.length > 0) {
      this.moderationStats.flaggedContent++;
    }
    
    if (moderation.status === 'rejected') {
      this.moderationStats.rejectedContent++;
    }
  }

  // Log moderation decision to audit trail
  logModerationDecision(moderation) {
    const auditEntry = {
      id: uuidv4(),
      moderationId: moderation.id,
      userId: moderation.userId,
      timestamp: new Date(),
      status: moderation.status,
      violations: moderation.violations,
      decision: moderation.decision,
      processingTime: moderation.processingTime,
      contentType: moderation.contentType
    };

    this.auditLog.push(auditEntry);
    
    // Keep only last 10000 audit entries
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-10000);
    }

    // Update user content history
    if (!this.contentHistory.has(moderation.userId)) {
      this.contentHistory.set(moderation.userId, []);
    }
    
    this.contentHistory.get(moderation.userId).push({
      moderationId: moderation.id,
      timestamp: new Date(),
      status: moderation.status,
      violations: moderation.violations,
      contentType: moderation.contentType
    });
  }

  // Get moderation statistics
  getStatistics() {
    return {
      ...this.moderationStats,
      averageProcessingTime: this.calculateAverageProcessingTime(),
      rejectionRate: (this.moderationStats.rejectedContent / this.moderationStats.totalChecks) * 100,
      flaggingRate: (this.moderationStats.flaggedContent / this.moderationStats.totalChecks) * 100
    };
  }

  // Get audit log for user or admin
  getAuditLog(options = {}) {
    const { userId, startDate, endDate, limit = 100 } = options;
    
    let filteredLog = this.auditLog;
    
    if (userId) {
      filteredLog = filteredLog.filter(entry => entry.userId === userId);
    }
    
    if (startDate) {
      filteredLog = filteredLog.filter(entry => entry.timestamp >= startDate);
    }
    
    if (endDate) {
      filteredLog = filteredLog.filter(entry => entry.timestamp <= endDate);
    }
    
    return filteredLog
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // Helper methods
  calculateRiskScore(safetyAnalysis) {
    let score = 0;
    if (safetyAnalysis.nsfw) score += 0.4;
    if (safetyAnalysis.violence) score += 0.3;
    if (safetyAnalysis.hateSpeech) score += 0.5;
    return Math.min(1.0, score);
  }

  calculateOverallConfidence(results) {
    const confidences = [];
    
    if (results.ageVerification?.confidence) confidences.push(results.ageVerification.confidence);
    if (results.animalDetection?.confidence) confidences.push(results.animalDetection.confidence);
    if (results.safetyAnalysis?.confidence) confidences.push(results.safetyAnalysis.confidence);
    
    if (confidences.length === 0) return 0.5;
    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  calculateOverallRiskScore(results) {
    let riskScore = 0;
    
    if (results.safetyAnalysis?.riskScore) riskScore += results.safetyAnalysis.riskScore * 0.5;
    if (results.behaviorAnalysis?.riskScore) riskScore += results.behaviorAnalysis.riskScore * 0.3;
    
    return Math.min(1.0, riskScore);
  }

  hasLowConfidenceResults(results) {
    const confidenceThreshold = 0.70;
    return results.ageVerification?.confidence < confidenceThreshold ||
           results.animalDetection?.confidence < confidenceThreshold ||
           results.safetyAnalysis?.confidence < confidenceThreshold;
  }

  getLowConfidenceDetails(results) {
    const details = [];
    
    if (results.ageVerification?.confidence < 0.70) {
      details.push(`Age verification confidence: ${results.ageVerification.confidence}`);
    }
    
    if (results.animalDetection?.confidence < 0.70) {
      details.push(`Animal detection confidence: ${results.animalDetection.confidence}`);
    }
    
    if (results.safetyAnalysis?.confidence < 0.70) {
      details.push(`Safety analysis confidence: ${results.safetyAnalysis.confidence}`);
    }
    
    return details;
  }

  calculateAverageProcessingTime() {
    if (this.moderationStats.processedItems === 0) return 0;
    
    let totalTime = 0;
    let count = 0;
    
    for (const moderation of this.moderationQueue.values()) {
      if (moderation.processingTime > 0) {
        totalTime += moderation.processingTime;
        count++;
      }
    }
    
    return count > 0 ? totalTime / count : 0;
  }

  detectLanguage(text) {
    // Simple language detection (in production, would use proper language detection)
    return text.match(/[à-ÿ]/) ? 'romance' : 'english';
  }

  analyzeSentiment(text) {
    // Simple sentiment analysis (in production, would use proper sentiment analysis)
    const positiveWords = ['good', 'great', 'awesome', 'love', 'happy'];
    const negativeWords = ['bad', 'terrible', 'hate', 'angry', 'sad'];
    
    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  checkProfanity(text) {
    // Simple profanity detection (in production, would use comprehensive lists)
    const profanityList = ['badword1', 'badword2', 'badword3'];
    const lowerText = text.toLowerCase();
    return profanityList.some(word => lowerText.includes(word));
  }
}

module.exports = ContentModerationService;