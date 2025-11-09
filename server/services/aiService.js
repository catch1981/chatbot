const OpenAI = require('openai');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.contextStore = new Map(); // In-memory context storage
    this.responseCache = new Map(); // Cache for similar responses
    
    // AI model configurations
    this.configs = {
      chat: {
        model: "gpt-3.5-turbo",
        maxTokens: 150,
        temperature: 0.7
      },
      creative: {
        model: "gpt-4",
        maxTokens: 300,
        temperature: 0.8
      },
      code: {
        model: "gpt-3.5-turbo",
        maxTokens: 200,
        temperature: 0.3
      }
    };
  }

  // Generate AI response based on conversation context
  async generateResponse(message, conversationId, userProfile = {}) {
    try {
      // Get conversation context
      const context = this.getConversationContext(conversationId);
      
      // Build prompt with context
      const systemPrompt = this.buildSystemPrompt(userProfile, context);
      
      // Generate response
      const completion = await this.openai.chat.completions.create({
        model: this.configs.chat.model,
        messages: [
          { role: "system", content: systemPrompt },
          ...context.messages.slice(-10), // Last 10 messages for context
          { role: "user", content: message }
        ],
        max_tokens: this.configs.chat.maxTokens,
        temperature: this.configs.chat.temperature,
        stream: false
      });

      const aiResponse = completion.choices[0].message.content.trim();
      
      // Update context
      this.updateConversationContext(conversationId, message, aiResponse);
      
      // Cache response for similar queries
      this.cacheResponse(message, aiResponse);
      
      return {
        id: uuidv4(),
        content: aiResponse,
        timestamp: new Date().toISOString(),
        type: 'ai_response',
        metadata: {
          model: this.configs.chat.model,
          tokens: completion.usage.total_tokens,
          confidence: this.calculateConfidence(completion)
        }
      };

    } catch (error) {
      console.error('AI Response Generation Error:', error);
      return this.getFallbackResponse(message);
    }
  }

  // Generate creative content (stories, descriptions, etc.)
  async generateCreativeContent(prompt, type = 'description') {
    try {
      const creativePrompts = {
        description: `Create a detailed, engaging description of: ${prompt}`,
        story: `Write a short, creative story about: ${prompt}`,
        dialogue: `Create a natural dialogue about: ${prompt}`,
        analysis: `Provide a thoughtful analysis of: ${prompt}`
      };

      const completion = await this.openai.chat.completions.create({
        model: this.configs.creative.model,
        messages: [
          { 
            role: "system", 
            content: "You are a creative AI assistant. Generate engaging, well-structured content that is both informative and entertaining." 
          },
          { role: "user", content: creativePrompts[type] || creativePrompts.description }
        ],
        max_tokens: this.configs.creative.maxTokens,
        temperature: this.configs.creative.temperature
      });

      return completion.choices[0].message.content.trim();

    } catch (error) {
      console.error('Creative Content Generation Error:', error);
      return `I encountered an error while generating creative content about "${prompt}". Please try again.`;
    }
  }

  // Enhance 3D model descriptions for better generation
  async enhance3DDescription(userPrompt) {
    try {
      const enhancementPrompt = `
        Enhance this 3D model description to be more detailed and specific for 3D generation:
        Original: "${userPrompt}"
        
        Provide:
        1. Enhanced description (2-3 sentences)
        2. Key visual characteristics
        3. Style suggestions
        4. Technical specifications
        
        Format as JSON with keys: enhancedDescription, visualCharacteristics, style, technicalSpecs
      `;

      const completion = await this.openai.chat.completions.create({
        model: this.configs.creative.model,
        messages: [
          { 
            role: "system", 
            content: "You are a 3D modeling expert. Enhance descriptions to be more suitable for 3D generation, focusing on visual details, materials, and technical aspects." 
          },
          { role: "user", content: enhancementPrompt }
        ],
        max_tokens: 200,
        temperature: 0.7
      });

      const response = completion.choices[0].message.content.trim();
      
      try {
        return JSON.parse(response);
      } catch {
        return {
          enhancedDescription: response,
          visualCharacteristics: [],
          style: "realistic",
          technicalSpecs: {}
        };
      }

    } catch (error) {
      console.error('3D Description Enhancement Error:', error);
      return {
        enhancedDescription: userPrompt,
        visualCharacteristics: [],
        style: "realistic",
        technicalSpecs: {}
      };
    }
  }

  // Generate conversation summaries
  async generateConversationSummary(conversationMessages) {
    try {
      const messagesText = conversationMessages
        .slice(-20) // Last 20 messages
        .map(msg => `${msg.username || 'User'}: ${msg.message}`)
        .join('\n');

      const summaryPrompt = `
        Summarize this conversation in 2-3 sentences, highlighting key topics and outcomes:
        
        ${messagesText}
      `;

      const completion = await this.openai.chat.completions.create({
        model: this.configs.chat.model,
        messages: [
          { 
            role: "system", 
            content: "You are a conversation analyst. Create concise, informative summaries that capture the essence of discussions." 
          },
          { role: "user", content: summaryPrompt }
        ],
        max_tokens: 100,
        temperature: 0.3
      });

      return completion.choices[0].message.content.trim();

    } catch (error) {
      console.error('Summary Generation Error:', error);
      return "Unable to generate conversation summary.";
    }
  }

  // Analyze sentiment and tone
  async analyzeSentiment(message) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: this.configs.chat.model,
        messages: [
          { 
            role: "system", 
            content: "Analyze the sentiment and tone of the following message. Respond with JSON containing: sentiment (positive/negative/neutral), emotion (happy/sad/angry/excited/calm/etc), and confidence (0-1)." 
          },
          { role: "user", content: message }
        ],
        max_tokens: 50,
        temperature: 0.1
      });

      const response = completion.choices[0].message.content.trim();
      
      try {
        return JSON.parse(response);
      } catch {
        return {
          sentiment: "neutral",
          emotion: "neutral",
          confidence: 0.5
        };
      }

    } catch (error) {
      console.error('Sentiment Analysis Error:', error);
      return {
        sentiment: "neutral",
        emotion: "neutral",
        confidence: 0.5
      };
    }
  }

  // Context management
  getConversationContext(conversationId) {
    if (!this.contextStore.has(conversationId)) {
      this.contextStore.set(conversationId, {
        messages: [],
        userProfile: {},
        lastActivity: new Date(),
        summary: ""
      });
    }
    return this.contextStore.get(conversationId);
  }

  updateConversationContext(conversationId, userMessage, aiResponse) {
    const context = this.getConversationContext(conversationId);
    context.messages.push(
      { role: "user", content: userMessage, timestamp: new Date() },
      { role: "assistant", content: aiResponse, timestamp: new Date() }
    );
    
    // Keep only last 50 messages for performance
    if (context.messages.length > 50) {
      context.messages = context.messages.slice(-50);
    }
    
    context.lastActivity = new Date();
  }

  buildSystemPrompt(userProfile, context) {
    const basePrompt = `You are a helpful AI assistant in a real-time chat application with 3D content generation capabilities.`;
    
    const userContext = userProfile.preferences ? 
      ` User preferences: ${JSON.stringify(userProfile.preferences)}` : '';
    
    const recentContext = context.messages.length > 0 ?
      ` Recent conversation context: ${context.messages.slice(-5).map(m => `${m.role}: ${m.content}`).join(', ')}` : '';

    return `${basePrompt}${userContext}${recentContext}
    
    Guidelines:
    - Be helpful, friendly, and informative
    - Adapt your responses to the user's tone and preferences
    - When appropriate, suggest 3D content generation
    - Keep responses concise but engaging
    - If discussing 3D models, be technical but accessible`;
  }

  // Response caching for performance
  cacheResponse(message, response) {
    const cacheKey = this.createCacheKey(message);
    this.responseCache.set(cacheKey, {
      response,
      timestamp: new Date()
    });
    
    // Clean old cache entries
    if (this.responseCache.size > 1000) {
      const oldest = Array.from(this.responseCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, 100);
      oldest.forEach(([key]) => this.responseCache.delete(key));
    }
  }

  createCacheKey(message) {
    return message.toLowerCase().trim().slice(0, 50);
  }

  calculateConfidence(completion) {
    // Simple confidence calculation based on response length and structure
    const content = completion.choices[0].message.content;
    const length = content.length;
    const hasStructure = content.includes('.') || content.includes('!') || content.includes('?');
    return Math.min(0.9, (length / 200) + (hasStructure ? 0.2 : 0));
  }

  getFallbackResponse(message) {
    const fallbacks = [
      "I apologize, but I'm having trouble processing your request right now. Could you try rephrasing?",
      "I'm experiencing some technical difficulties. Let me try to help you in a different way.",
      "I understand what you're asking, but I'm not able to provide a response at the moment. Please try again.",
      "I notice there might be an issue with my response generation. Can you ask me something else?"
    ];
    
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  // Clean up old contexts
  cleanupContexts() {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [conversationId, context] of this.contextStore.entries()) {
      if (now - context.lastActivity > maxAge) {
        this.contextStore.delete(conversationId);
      }
    }
  }
}

module.exports = AIService;