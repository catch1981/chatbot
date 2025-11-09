const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class AIPersonalityService extends EventEmitter {
  constructor() {
    super();
    this.userPersonalities = new Map();
    this.learningProfiles = new Map();
    this.personalityTemplates = this.initializePersonalityTemplates();
    this.learningAlgorithm = new AdaptiveLearningEngine();
    this.interactionHistory = new Map();
  }

  // Initialize personality templates
  initializePersonalityTemplates() {
    return {
      professional: {
        name: "Professional Assistant",
        traits: {
          formality: 0.9,
          creativity: 0.6,
          humor: 0.2,
          empathy: 0.7,
          technical_depth: 0.9,
          efficiency: 0.9,
          thoroughness: 0.9
        },
        communication_style: {
          greeting: "Good day. How may I assist you with your project today?",
          response_length: "detailed",
          tone: "professional",
          language: "formal",
          technical_level: "advanced"
        },
        behavior_patterns: {
          question_style: "analytical",
          explanation_style: "structured",
          suggestion_approach: "evidence-based"
        }
      },
      creative: {
        name: "Creative Collaborator",
        traits: {
          formality: 0.3,
          creativity: 0.95,
          humor: 0.8,
          empathy: 0.8,
          technical_depth: 0.6,
          efficiency: 0.7,
          thoroughness: 0.6
        },
        communication_style: {
          greeting: "Hey there! Ready to create something amazing together?",
          response_length: "engaging",
          tone: "enthusiastic",
          language: "casual",
          technical_level: "accessible"
        },
        behavior_patterns: {
          question_style: "exploratory",
          explanation_style: "visual",
          suggestion_approach: "creative"
        }
      },
      casual: {
        name: "Friendly Companion",
        traits: {
          formality: 0.2,
          creativity: 0.7,
          humor: 0.8,
          empathy: 0.9,
          technical_depth: 0.5,
          efficiency: 0.6,
          thoroughness: 0.5
        },
        communication_style: {
          greeting: "Hi! What's on your mind today?",
          response_length: "conversational",
          tone: "warm",
          language: "casual",
          technical_level: "simple"
        },
        behavior_patterns: {
          question_style: "conversational",
          explanation_style: "relatable",
          suggestion_approach: "supportive"
        }
      },
      technical: {
        name: "Technical Expert",
        traits: {
          formality: 0.8,
          creativity: 0.5,
          humor: 0.1,
          empathy: 0.5,
          technical_depth: 0.95,
          efficiency: 0.8,
          thoroughness: 0.95
        },
        communication_style: {
          greeting: "Greetings. What technical challenge can I help you solve?",
          response_length: "comprehensive",
          tone: "precise",
          language: "technical",
          technical_level: "expert"
        },
        behavior_patterns: {
          question_style: "technical",
          explanation_style: "detailed",
          suggestion_approach: "methodical"
        }
      },
      supportive: {
        name: "Supportive Guide",
        traits: {
          formality: 0.4,
          creativity: 0.6,
          humor: 0.4,
          empathy: 0.95,
          technical_depth: 0.7,
          efficiency: 0.5,
          thoroughness: 0.8
        },
        communication_style: {
          greeting: "Hello! I'm here to help and support you.",
          response_length: "considerate",
          tone: "caring",
          language: "accessible",
          technical_level: "adaptive"
        },
        behavior_patterns: {
          question_style: "empathetic",
          explanation_style: "step-by-step",
          suggestion_approach: "encouraging"
        }
      }
    };
  }

  // Create or get user's AI personality
  async getUserPersonality(userId, userData = {}) {
    if (this.userPersonalities.has(userId)) {
      return this.userPersonalities.get(userId);
    }

    // Create new personality based on user preferences and behavior
    const personality = await this.createPersonalizedPersonality(userId, userData);
    this.userPersonalities.set(userId, personality);
    
    return personality;
  }

  // Create personalized AI personality
  async createPersonalizedPersonality(userId, userData) {
    const { 
      preferences = {},
      communication_style = {},
      technical_level = 'intermediate',
      goals = [],
      industry = 'general'
    } = userData;

    // Analyze user preferences
    const personalityProfile = this.analyzeUserPreferences(preferences, communication_style);
    
    // Select base template
    const baseTemplate = this.selectBaseTemplate(personalityProfile, industry);
    
    // Customize personality based on user data
    const customizedPersonality = this.customizePersonality(baseTemplate, {
      technical_level,
      goals,
      user_preferences: preferences
    });

    // Initialize learning profile
    const learningProfile = this.learningAlgorithm.createLearningProfile(userId, customizedPersonality);

    const personality = {
      id: uuidv4(),
      userId,
      base_template: baseTemplate.name,
      traits: customizedPersonality.traits,
      communication_style: customizedPersonality.communication_style,
      behavior_patterns: customizedPersonality.behavior_patterns,
      learning_profile: learningProfile,
      adaptations: new Map(),
      interaction_count: 0,
      satisfaction_score: 0.8,
      last_updated: new Date(),
      created_at: new Date()
    };

    return personality;
  }

  // Analyze user preferences to determine personality traits
  analyzeUserPreferences(preferences, communication_style) {
    const profile = {
      preferred_formality: preferences.formality || 0.5,
      preferred_creativity: preferences.creativity || 0.6,
      preferred_technical_depth: preferences.technical_depth || 0.6,
      preferred_response_length: preferences.response_length || 'medium',
      preferred_tone: preferences.tone || 'friendly',
      communication_efficiency: communication_style.efficiency || 0.7,
      learning_style: this.inferLearningStyle(preferences),
      industry_influence: this.getIndustryInfluence(preferences.industry || 'general')
    };

    return profile;
  }

  // Select appropriate base personality template
  selectBaseTemplate(profile, industry) {
    const templates = this.personalityTemplates;
    
    // Industry-specific adjustments
    const industryModifiers = {
      'tech': { technical_depth: 0.3, efficiency: 0.2 },
      'creative': { creativity: 0.3, humor: 0.2 },
      'business': { formality: 0.2, efficiency: 0.1 },
      'education': { empathy: 0.2, thoroughness: 0.2 },
      'healthcare': { empathy: 0.3, formality: 0.1 }
    };

    const modifier = industryModifiers[industry] || {};

    // Score templates based on profile match
    const scores = Object.entries(templates).map(([key, template]) => {
      let score = 0;
      
      // Formality match
      score += (1 - Math.abs(profile.preferred_formality - template.traits.formality)) * 0.2;
      
      // Creativity match
      score += (1 - Math.abs(profile.preferred_creativity - template.traits.creativity)) * 0.2;
      
      // Technical depth match
      score += (1 - Math.abs(profile.preferred_technical_depth - template.traits.technical_depth)) * 0.2;
      
      // Response length match
      const lengthMatch = this.calculateResponseLengthMatch(
        profile.preferred_response_length, 
        template.communication_style.response_length
      );
      score += lengthMatch * 0.2;
      
      // Tone match
      const toneMatch = this.calculateToneMatch(
        profile.preferred_tone,
        template.communication_style.tone
      );
      score += toneMatch * 0.2;
      
      // Apply industry modifiers
      Object.entries(modifier).forEach(([trait, modifier_value]) => {
        if (template.traits[trait]) {
          score += (template.traits[trait] * modifier_value) * 0.1;
        }
      });

      return { key, template, score };
    });

    // Sort by score and return best match
    scores.sort((a, b) => b.score - a.score);
    return scores[0].template;
  }

  // Customize personality based on user data
  customizePersonality(baseTemplate, userData) {
    const customized = JSON.parse(JSON.stringify(baseTemplate));
    const { technical_level, goals, user_preferences } = userData;

    // Adjust traits based on user preferences
    if (user_preferences.formality !== undefined) {
      customized.traits.formality = this.blendValues(
        customized.traits.formality, 
        user_preferences.formality, 
        0.3
      );
    }

    if (user_preferences.creativity !== undefined) {
      customized.traits.creativity = this.blendValues(
        customized.traits.creativity,
        user_preferences.creativity,
        0.3
      );
    }

    // Adjust for technical level
    const technicalAdjustments = {
      'beginner': { technical_depth: -0.3, thoroughness: 0.2 },
      'intermediate': { technical_depth: 0, thoroughness: 0.1 },
      'advanced': { technical_depth: 0.3, efficiency: 0.2 },
      'expert': { technical_depth: 0.4, efficiency: 0.3 }
    };

    const adjustment = technicalAdjustments[technical_level] || {};
    Object.entries(adjustment).forEach(([trait, value]) => {
      if (customized.traits[trait] !== undefined) {
        customized.traits[trait] = Math.max(0, Math.min(1, 
          customized.traits[trait] + value
        ));
      }
    });

    // Goal-based adaptations
    if (goals.includes('learning')) {
      customized.traits.thoroughness += 0.2;
      customized.traits.empathy += 0.1;
    }

    if (goals.includes('efficiency')) {
      customized.traits.efficiency += 0.2;
      customized.traits.formality += 0.1;
    }

    if (goals.includes('creativity')) {
      customized.traits.creativity += 0.2;
      customized.traits.humor += 0.1;
    }

    return customized;
  }

  // Generate personalized response based on personality
  async generatePersonalizedResponse(personality, baseResponse, context) {
    const { 
      traits, 
      communication_style, 
      behavior_patterns,
      learning_profile 
    } = personality;

    // Adapt response based on personality traits
    let adaptedResponse = this.adaptResponseStyle(baseResponse, traits, communication_style);
    
    // Apply learning-based adaptations
    adaptedResponse = this.learningAlgorithm.applyLearning(
      adaptedResponse, 
      learning_profile, 
      context
    );

    // Add personality-specific elements
    adaptedResponse = this.addPersonalityElements(adaptedResponse, communication_style, traits);
    
    // Ensure response matches user's preferred length
    adaptedResponse = this.adjustResponseLength(adaptedResponse, communication_style.response_length);

    return adaptedResponse;
  }

  // Adapt response style based on personality traits
  adaptResponseStyle(response, traits, communication_style) {
    let adapted = { ...response };

    // Formality adjustment
    if (traits.formality < 0.4) {
      adapted.content = this.makeCasual(adapted.content);
    } else if (traits.formality > 0.8) {
      adapted.content = this.makeFormal(adapted.content);
    }

    // Creativity adjustment
    if (traits.creativity > 0.7) {
      adapted.content = this.addCreativity(adapted.content, traits.creativity);
    }

    // Technical depth adjustment
    if (traits.technical_depth < 0.5) {
      adapted = this.simplifyTechnicalContent(adapted);
    } else if (traits.technical_depth > 0.8) {
      adapted = this.addTechnicalDepth(adapted);
    }

    // Humor adjustment
    if (traits.humor > 0.6) {
      adapted = this.addAppropriateHumor(adapted.content, traits.humor);
      adapted.content = adapted.content;
    }

    return adapted;
  }

  // Add personality-specific elements to response
  addPersonalityElements(response, communication_style, traits) {
    const elements = {};

    // Add appropriate greeting if this is a new conversation
    if (response.isFirstMessage) {
      elements.greeting = communication_style.greeting;
    }

    // Add personality-specific sign-offs
    if (traits.formality > 0.7) {
      elements.closing = "Please let me know if you need any further assistance.";
    } else if (traits.humor > 0.6) {
      elements.closing = "Feel free to ask if you need anything else!";
    } else {
      elements.closing = "Let me know if I can help with anything else.";
    }

    // Add empathy cues
    if (traits.empathy > 0.7) {
      elements.empathy = this.addEmpathyCues(response.content);
    }

    return { ...response, ...elements };
  }

  // Learn from user interactions
  async learnFromInteraction(userId, interaction) {
    const personality = this.userPersonalities.get(userId);
    if (!personality) return;

    const { input, output, feedback, context, outcome } = interaction;

    // Update learning profile
    personality.learning_profile = this.learningAlgorithm.updateProfile(
      personality.learning_profile,
      interaction
    );

    // Track interaction for pattern analysis
    this.trackInteraction(userId, interaction);

    // Adjust personality based on feedback
    if (feedback && feedback.satisfaction !== undefined) {
      await this.adjustPersonalityBasedOnFeedback(personality, feedback);
    }

    // Update interaction count and satisfaction
    personality.interaction_count++;
    if (feedback && feedback.satisfaction) {
      personality.satisfaction_score = this.calculateSatisfactionScore(
        personality.satisfaction_score,
        feedback.satisfaction,
        personality.interaction_count
      );
    }

    personality.last_updated = new Date();
    this.userPersonalities.set(userId, personality);

    // Emit learning event
    this.emit('personalityUpdated', { userId, personality, interaction });
  }

  // Adjust personality based on user feedback
  async adjustPersonalityBasedOnFeedback(personality, feedback) {
    const { satisfaction, preferences, specific_feedback } = feedback;
    
    // If user wants more formality
    if (specific_feedback?.includes('more formal')) {
      personality.traits.formality = Math.min(1, personality.traits.formality + 0.1);
    }
    
    // If user wants less technical content
    if (specific_feedback?.includes('too technical')) {
      personality.traits.technical_depth = Math.max(0, personality.traits.technical_depth - 0.1);
    }
    
    // If user wants more creative responses
    if (specific_feedback?.includes('more creative')) {
      personality.traits.creativity = Math.min(1, personality.traits.creativity + 0.1);
    }

    // Adjust based on satisfaction levels
    if (satisfaction < 0.6) {
      // User is not satisfied, become more adaptable
      personality.traits.empathy = Math.min(1, personality.traits.empathy + 0.05);
    } else if (satisfaction > 0.8) {
      // User is very satisfied, reinforce current approach
      // No change needed, current personality is working well
    }
  }

  // Generate personality insights and recommendations
  async generatePersonalityInsights(userId) {
    const personality = this.userPersonalities.get(userId);
    if (!personality) return null;

    const insights = {
      personality_type: personality.base_template,
      dominant_traits: this.getDominantTraits(personality.traits),
      communication_style: this.analyzeCommunicationStyle(personality),
      learning_progress: this.learningAlgorithm.getProgress(personality.learning_profile),
      satisfaction_trend: this.analyzeSatisfactionTrend(userId),
      recommendations: this.generatePersonalityRecommendations(personality),
      adaptation_suggestions: this.generateAdaptationSuggestions(personality)
    };

    return insights;
  }

  // Get user's interaction patterns
  getUserInteractionPatterns(userId) {
    const history = this.interactionHistory.get(userId) || [];
    
    return {
      total_interactions: history.length,
      average_session_length: this.calculateAverageSessionLength(history),
      most_active_hours: this.getMostActiveHours(history),
      common_topics: this.extractCommonTopics(history),
      satisfaction_trend: this.analyzeSatisfactionTrend(userId),
      preferred_features: this.analyzePreferredFeatures(history)
    };
  }

  // Create personality snapshot for sharing/backup
  createPersonalitySnapshot(userId) {
    const personality = this.userPersonalities.get(userId);
    if (!personality) return null;

    return {
      userId: personality.userId,
      personality_type: personality.base_template,
      traits: personality.traits,
      communication_style: personality.communication_style,
      learning_profile_summary: this.learningAlgorithm.createSnapshot(personality.learning_profile),
      satisfaction_score: personality.satisfaction_score,
      interaction_count: personality.interaction_count,
      created_at: personality.created_at,
      last_updated: personality.last_updated
    };
  }

  // Helper Methods

  inferLearningStyle(preferences) {
    const indicators = {
      visual: preferences.visual_learning || 0,
      auditory: preferences.auditory_learning || 0,
      kinesthetic: preferences.kinesthetic_learning || 0,
      reading: preferences.reading_writing || 0
    };
    
    return Object.keys(indicators).reduce((a, b) => 
      indicators[a] > indicators[b] ? a : b
    );
  }

  getIndustryInfluence(industry) {
    const influences = {
      tech: { formality: -0.1, creativity: 0.1, efficiency: 0.2 },
      creative: { creativity: 0.3, formality: -0.2, humor: 0.2 },
      business: { formality: 0.2, efficiency: 0.1, thoroughness: 0.1 },
      education: { empathy: 0.2, thoroughness: 0.1, formality: 0.1 },
      healthcare: { empathy: 0.3, thoroughness: 0.2, formality: 0.1 }
    };
    
    return influences[industry] || {};
  }

  calculateResponseLengthMatch(preferred, template) {
    const matches = {
      short: { short: 1, medium: 0.7, long: 0.3, detailed: 0.1 },
      medium: { short: 0.6, medium: 1, long: 0.8, detailed: 0.5 },
      long: { short: 0.2, medium: 0.7, long: 1, detailed: 0.9 },
      detailed: { short: 0.1, medium: 0.4, long: 0.8, detailed: 1 }
    };
    
    return matches[preferred]?.[template] || 0.5;
  }

  calculateToneMatch(preferred, template) {
    const toneCompatibility = {
      friendly: { warm: 1, professional: 0.6, enthusiastic: 0.8, caring: 0.9 },
      professional: { warm: 0.5, professional: 1, enthusiastic: 0.4, caring: 0.6 },
      enthusiastic: { warm: 0.8, professional: 0.4, enthusiastic: 1, caring: 0.7 },
      caring: { warm: 0.9, professional: 0.6, enthusiastic: 0.7, caring: 1 }
    };
    
    return toneCompatibility[preferred]?.[template] || 0.5;
  }

  blendValues(baseValue, targetValue, weight) {
    return baseValue * (1 - weight) + targetValue * weight;
  }

  makeCasual(content) {
    return content
      .replace(/\bplease\b/gi, '')
      .replace(/\bI would\b/gi, "I'd")
      .replace(/\bI will\b/gi, "I'll")
      .replace(/\bdo not\b/gi, "don't")
      .replace(/\bcannot\b/gi, "can't");
  }

  makeFormal(content) {
    return content
      .replace(/\bI'm\b/gi, "I am")
      .replace(/\bI'll\b/gi, "I will")
      .replace(/\bdon't\b/gi, "do not")
      .replace(/\bcan't\b/gi, "cannot")
      .replace(/\bwon't\b/gi, "will not");
  }

  addCreativity(content, creativityLevel) {
    const creativePhrases = [
      "Here's a creative approach:",
      "Let's think outside the box:",
      "Here's something innovative:",
      "Here's a fresh perspective:"
    ];
    
    if (Math.random() < creativityLevel * 0.3) {
      const phrase = creativePhrases[Math.floor(Math.random() * creativePhrases.length)];
      return `${phrase}\n\n${content}`;
    }
    
    return content;
  }

  simplifyTechnicalContent(response) {
    // Replace technical jargon with simpler terms
    const simplifications = {
      'API': 'interface',
      'endpoint': 'connection point',
      'database': 'data storage',
      'algorithm': 'method',
      'optimize': 'improve',
      'implement': 'create'
    };
    
    let simplified = response.content;
    Object.entries(simplifications).forEach(([technical, simple]) => {
      simplified = simplified.replace(new RegExp(technical, 'gi'), simple);
    });
    
    return { ...response, content: simplified };
  }

  addTechnicalDepth(response) {
    // Add technical details and explanations
    const technicalAdders = [
      "\n\nFrom a technical perspective:",
      "\n\nTechnical implementation details:",
      "\n\nHere's the technical breakdown:"
    ];
    
    if (Math.random() < 0.4) {
      const adder = technicalAdders[Math.floor(Math.random() * technicalAdders.length)];
      return response.content + adder;
    }
    
    return response.content;
  }

  addAppropriateHumor(content, humorLevel) {
    if (humorLevel > 0.7 && Math.random() < 0.2) {
      const lightHumor = [
        " (No AI models were harmed in the making of this response!)",
        " 🤖",
        " (Disclaimer: I don't actually have feelings, but I appreciate the question!)",
        " 😉"
      ];
      
      const humor = lightHumor[Math.floor(Math.random() * lightHumor.length)];
      return content + humor;
    }
    
    return content;
  }

  addEmpathyCues(content) {
    const empathyStarters = [
      "I understand that",
      "I can see that",
      "It sounds like",
      "I appreciate that"
    ];
    
    if (content.includes('?') && Math.random() < 0.3) {
      const starter = empathyStarters[Math.floor(Math.random() * empathyStarters.length)];
      return `${starter} you're asking about. ${content}`;
    }
    
    return content;
  }

  adjustResponseLength(response, preferredLength) {
    const currentLength = response.content.length;
    let targetLength;
    
    switch (preferredLength) {
      case 'short': targetLength = 100; break;
      case 'medium': targetLength = 300; break;
      case 'long': targetLength = 600; break;
      case 'detailed': targetLength = 1000; break;
      default: targetLength = 300;
    }
    
    if (currentLength > targetLength * 1.5) {
      // Response is too long, summarize
      return this.summarizeResponse(response, targetLength);
    } else if (currentLength < targetLength * 0.5) {
      // Response is too short, expand
      return this.expandResponse(response, targetLength);
    }
    
    return response;
  }

  summarizeResponse(response, targetLength) {
    // Simple summarization - take first portion and add summary
    const words = response.content.split(' ');
    const targetWords = Math.floor(targetLength / 5); // Rough word count estimation
    
    if (words.length > targetWords) {
      const summary = words.slice(0, targetWords).join(' ') + '...';
      return { ...response, content: summary };
    }
    
    return response;
  }

  expandResponse(response, targetLength) {
    // Add relevant expansion based on content
    const expansions = {
      'create': '\n\nTo get started, you\'ll want to:',
      'help': '\n\nHere are some additional ways I can assist you:',
      'explain': '\n\nLet me break this down further:',
      'show': '\n\nHere are the key details:'
    };
    
    const content = response.content.toLowerCase();
    for (const [key, expansion] of Object.entries(expansions)) {
      if (content.includes(key)) {
        return { ...response, content: response.content + expansion };
      }
    }
    
    return response;
  }

  trackInteraction(userId, interaction) {
    if (!this.interactionHistory.has(userId)) {
      this.interactionHistory.set(userId, []);
    }
    
    const history = this.interactionHistory.get(userId);
    history.push({
      ...interaction,
      timestamp: new Date()
    });
    
    // Keep only last 1000 interactions
    if (history.length > 1000) {
      this.interactionHistory.set(userId, history.slice(-1000));
    }
  }

  calculateSatisfactionScore(current, newSatisfaction, interactionCount) {
    // Exponential moving average
    const alpha = Math.min(0.1, 1 / interactionCount);
    return current * (1 - alpha) + newSatisfaction * alpha;
  }

  getDominantTraits(traits) {
    return Object.entries(traits)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([trait, value]) => ({ trait, value }));
  }

  analyzeCommunicationStyle(personality) {
    const style = personality.communication_style;
    return {
      formality_level: style.tone === 'professional' ? 'high' : 
                       style.tone === 'warm' ? 'low' : 'medium',
      response_length: style.response_length,
      language_complexity: style.technical_level,
      approach: personality.behavior_patterns.suggestion_approach
    };
  }

  analyzeSatisfactionTrend(userId) {
    const history = this.interactionHistory.get(userId) || [];
    const recentSatisfactions = history
      .filter(h => h.feedback?.satisfaction)
      .slice(-10)
      .map(h => h.feedback.satisfaction);
    
    if (recentSatisfactions.length < 2) return 'insufficient_data';
    
    const trend = recentSatisfactions[recentSatisfactions.length - 1] - recentSatisfactions[0];
    if (trend > 0.1) return 'improving';
    if (trend < -0.1) return 'declining';
    return 'stable';
  }

  generatePersonalityRecommendations(personality) {
    const recommendations = [];
    
    if (personality.traits.empathy < 0.6) {
      recommendations.push("Consider being more understanding of user emotions");
    }
    
    if (personality.traits.creativity < 0.5) {
      recommendations.push("Try more creative and innovative approaches");
    }
    
    if (personality.satisfaction_score < 0.7) {
      recommendations.push("Focus on improving user satisfaction through better adaptation");
    }
    
    return recommendations;
  }

  generateAdaptationSuggestions(personality) {
    const suggestions = [];
    
    if (personality.learning_profile.adaptation_rate < 0.5) {
      suggestions.push("Increase adaptation rate to respond better to user feedback");
    }
    
    if (personality.learning_profile.exploration_score < 0.3) {
      suggestions.push("Explore more varied response styles to find what works best");
    }
    
    return suggestions;
  }

  calculateAverageSessionLength(history) {
    if (history.length === 0) return 0;
    
    const sessions = this.groupInteractionsBySession(history);
    const sessionLengths = sessions.map(session => session.length);
    
    return sessionLengths.reduce((sum, length) => sum + length, 0) / sessionLengths.length;
  }

  groupInteractionsBySession(history) {
    const sessions = [];
    let currentSession = [];
    const sessionGap = 30 * 60 * 1000; // 30 minutes
    
    for (const interaction of history) {
      if (currentSession.length === 0 || 
          interaction.timestamp - currentSession[currentSession.length - 1].timestamp < sessionGap) {
        currentSession.push(interaction);
      } else {
        if (currentSession.length > 0) {
          sessions.push(currentSession);
        }
        currentSession = [interaction];
      }
    }
    
    if (currentSession.length > 0) {
      sessions.push(currentSession);
    }
    
    return sessions;
  }

  getMostActiveHours(history) {
    const hourCounts = {};
    
    history.forEach(interaction => {
      const hour = new Date(interaction.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    return Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }));
  }

  extractCommonTopics(history) {
    const topics = {};
    
    history.forEach(interaction => {
      if (interaction.input) {
        const words = interaction.input.toLowerCase().split(' ');
        words.forEach(word => {
          if (word.length > 3) {
            topics[word] = (topics[word] || 0) + 1;
          }
        });
      }
    });
    
    return Object.entries(topics)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));
  }

  analyzePreferredFeatures(history) {
    const features = {};
    
    history.forEach(interaction => {
      if (interaction.context?.features_used) {
        interaction.context.features_used.forEach(feature => {
          features[feature] = (features[feature] || 0) + 1;
        });
      }
    });
    
    return Object.entries(features)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([feature, count]) => ({ feature, count }));
  }
}

// Adaptive Learning Engine
class AdaptiveLearningEngine {
  constructor() {
    this.learningModels = new Map();
  }

  createLearningProfile(userId, personality) {
    return {
      userId,
      adaptation_rate: 0.5,
      exploration_score: 0.5,
      feedback_weight: 0.3,
      success_patterns: new Map(),
      failure_patterns: new Map(),
      preferred_structures: new Map(),
      learning_history: [],
      last_updated: new Date()
    };
  }

  updateProfile(learningProfile, interaction) {
    const { feedback, outcome, input, output } = interaction;
    
    // Update adaptation rate based on feedback
    if (feedback?.satisfaction !== undefined) {
      const delta = feedback.satisfaction - 0.5; // Target satisfaction of 0.5
      learningProfile.adaptation_rate = Math.max(0.1, Math.min(1.0, 
        learningProfile.adaptation_rate + delta * 0.1
      ));
    }
    
    // Record successful patterns
    if (feedback?.satisfaction > 0.7) {
      this.recordSuccessfulPattern(learningProfile, input, output);
    }
    
    // Record failed patterns
    if (feedback?.satisfaction < 0.4) {
      this.recordFailedPattern(learningProfile, input, output);
    }
    
    // Update learning history
    learningProfile.learning_history.push({
      timestamp: new Date(),
      interaction_summary: {
        input_length: input?.length || 0,
        output_length: output?.content?.length || 0,
        satisfaction: feedback?.satisfaction || 0.5
      }
    });
    
    learningProfile.last_updated = new Date();
    
    return learningProfile;
  }

  recordSuccessfulPattern(learningProfile, input, output) {
    const pattern = this.extractPattern(input, output);
    const current = learningProfile.success_patterns.get(pattern) || 0;
    learningProfile.success_patterns.set(pattern, current + 1);
  }

  recordFailedPattern(learningProfile, input, output) {
    const pattern = this.extractPattern(input, output);
    const current = learningProfile.failure_patterns.get(pattern) || 0;
    learningProfile.failure_patterns.set(pattern, current + 1);
  }

  extractPattern(input, output) {
    // Simple pattern extraction based on input characteristics
    const patterns = [];
    
    if (input?.includes('?')) patterns.push('question');
    if (input?.length > 100) patterns.push('long_input');
    if (input?.includes('3D') || input?.includes('model')) patterns.push('3d_related');
    if (input?.includes('create') || input?.includes('make')) patterns.push('creation_request');
    
    return patterns.join('_') || 'general';
  }

  applyLearning(baseResponse, learningProfile, context) {
    let adaptedResponse = { ...baseResponse };
    
    // Apply successful patterns
    const inputPattern = this.extractPattern(context?.input, baseResponse);
    const successCount = learningProfile.success_patterns.get(inputPattern) || 0;
    
    if (successCount > 0) {
      // Reinforce successful approaches
      adaptedResponse.confidence_boost = Math.min(0.2, successCount * 0.05);
    }
    
    // Avoid failed patterns
    const failureCount = learningProfile.failure_patterns.get(inputPattern) || 0;
    if (failureCount > 2) {
      // Try alternative approach if this pattern has failed before
      adaptedResponse.alternative_approach = true;
    }
    
    return adaptedResponse;
  }

  getProgress(learningProfile) {
    const recentHistory = learningProfile.learning_history.slice(-20);
    
    return {
      adaptation_improvement: this.calculateAdaptationImprovement(learningProfile),
      success_rate: this.calculateSuccessRate(learningProfile),
      learning_velocity: this.calculateLearningVelocity(learningProfile),
      pattern_recognition: this.assessPatternRecognition(learningProfile)
    };
  }

  createSnapshot(learningProfile) {
    return {
      adaptation_rate: learningProfile.adaptation_rate,
      success_patterns: Object.fromEntries(learningProfile.success_patterns),
      total_learning_events: learningProfile.learning_history.length
    };
  }

  calculateAdaptationImprovement(learningProfile) {
    // Compare early vs recent adaptation rates
    if (learningProfile.learning_history.length < 10) return 0;
    
    const early = learningProfile.learning_history.slice(0, 5)
      .reduce((sum, event) => sum + event.interaction_summary.satisfaction, 0) / 5;
    const recent = learningProfile.learning_history.slice(-5)
      .reduce((sum, event) => sum + event.interaction_summary.satisfaction, 0) / 5;
    
    return recent - early;
  }

  calculateSuccessRate(learningProfile) {
    const totalInteractions = learningProfile.learning_history.length;
    if (totalInteractions === 0) return 0;
    
    const successes = learningProfile.learning_history
      .filter(event => event.interaction_summary.satisfaction > 0.6).length;
    
    return successes / totalInteractions;
  }

  calculateLearningVelocity(learningProfile) {
    // How quickly the AI is improving
    const recent = learningProfile.learning_history.slice(-10);
    if (recent.length < 3) return 0;
    
    const trend = recent[recent.length - 1].interaction_summary.satisfaction - 
                  recent[0].interaction_summary.satisfaction;
    
    return trend / recent.length;
  }

  assessPatternRecognition(learningProfile) {
    const totalPatterns = learningProfile.success_patterns.size + 
                         learningProfile.failure_patterns.size;
    
    if (totalPatterns === 0) return 0;
    
    const recognizedPatterns = Array.from(learningProfile.success_patterns.keys())
      .filter(pattern => learningProfile.success_patterns.get(pattern) > 1).length;
    
    return recognizedPatterns / totalPatterns;
  }
}

module.exports = AIPersonalityService;