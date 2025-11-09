const axios = require('axios');
const FormData = require('form-data');
const { v4: uuidv4 } = require('uuid');

class MultimodalService {
  constructor() {
    this.supportedLanguages = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'ru', 'pt'];
    this.voiceProcessingQueue = new Map();
    this.imageProcessingQueue = new Map();
    this.processingJobs = new Map();
  }

  // Voice-to-3D Generation
  async processVoiceTo3D(audioBlob, options = {}) {
    const jobId = uuidv4();
    
    try {
      // Start processing job
      this.processingJobs.set(jobId, {
        id: jobId,
        type: 'voice-to-3d',
        status: 'processing',
        progress: 0,
        startedAt: new Date(),
        options
      });

      // Step 1: Speech-to-Text
      this.updateJobProgress(jobId, 10, 'Converting speech to text...');
      const transcription = await this.speechToText(audioBlob, options.language || 'en');
      
      if (!transcription || transcription.trim().length === 0) {
        throw new Error('No speech detected in audio');
      }

      // Step 2: Intent Recognition
      this.updateJobProgress(jobId, 30, 'Analyzing intent...');
      const intent = await this.analyzeVoiceIntent(transcription, options.context);
      
      // Step 3: 3D Description Enhancement
      this.updateJobProgress(jobId, 50, 'Enhancing 3D description...');
      const enhancedDescription = await this.enhanceVoiceDescription(transcription, intent, options);
      
      // Step 4: 3D Model Generation
      this.updateJobProgress(jobId, 70, 'Generating 3D model...');
      const model = await this.generate3DFromVoice(enhancedDescription, options);
      
      // Step 5: Voice Command Processing
      this.updateJobProgress(jobId, 90, 'Processing voice commands...');
      const voiceCommands = await this.extractVoiceCommands(transcription);
      
      this.updateJobProgress(jobId, 100, 'Complete!');
      
      const result = {
        jobId,
        transcription,
        intent,
        description: enhancedDescription,
        model,
        voiceCommands,
        confidence: this.calculateVoiceConfidence(audioBlob, transcription),
        processingTime: Date.now() - this.processingJobs.get(jobId).startedAt.getTime(),
        metadata: {
          audioDuration: options.audioDuration,
          language: options.language,
          speakerId: options.speakerId
        }
      };

      this.processingJobs.set(jobId, { ...this.processingJobs.get(jobId), status: 'completed', result });
      return result;

    } catch (error) {
      this.processingJobs.set(jobId, { 
        ...this.processingJobs.get(jobId), 
        status: 'failed', 
        error: error.message 
      });
      throw error;
    }
  }

  // Image-to-3D Generation
  async processImageTo3D(imageBlob, options = {}) {
    const jobId = uuidv4();
    
    try {
      this.processingJobs.set(jobId, {
        id: jobId,
        type: 'image-to-3d',
        status: 'processing',
        progress: 0,
        startedAt: new Date(),
        options
      });

      // Step 1: Image Analysis
      this.updateJobProgress(jobId, 20, 'Analyzing image...');
      const imageAnalysis = await this.analyzeImage(imageBlob, options.analysisType || 'comprehensive');
      
      // Step 2: Object Detection
      this.updateJobProgress(jobId, 40, 'Detecting objects...');
      const objects = await this.detectObjectsInImage(imageAnalysis, options);
      
      // Step 3: Depth Estimation
      this.updateJobProgress(jobId, 60, 'Estimating depth...');
      const depthMap = await this.estimateDepthMap(imageBlob, objects);
      
      // Step 4: 3D Scene Reconstruction
      this.updateJobProgress(jobId, 80, 'Reconstructing 3D scene...');
      const scene3D = await this.reconstruct3DScene(objects, depthMap, imageAnalysis);
      
      this.updateJobProgress(jobId, 100, 'Complete!');
      
      const result = {
        jobId,
        imageAnalysis,
        objects,
        depthMap,
        scene3D,
        confidence: this.calculateImageConfidence(imageBlob, objects),
        processingTime: Date.now() - this.processingJobs.get(jobId).startedAt.getTime(),
        metadata: {
          imageSize: options.imageSize,
          analysisType: options.analysisType,
          objectsCount: objects.length
        }
      };

      this.processingJobs.set(jobId, { ...this.processingJobs.get(jobId), status: 'completed', result });
      return result;

    } catch (error) {
      this.processingJobs.set(jobId, { 
        ...this.processingJobs.get(jobId), 
        status: 'failed', 
        error: error.message 
      });
      throw error;
    }
  }

  // Speech-to-Text Processing
  async speechToText(audioBlob, language = 'en') {
    try {
      // Using OpenAI Whisper API
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', language);
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'word');

      const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders()
        }
      });

      return {
        text: response.data.text,
        language: response.data.language,
        duration: response.data.duration,
        segments: response.data.segments,
        confidence: this.calculateSTTConfidence(response.data.segments)
      };

    } catch (error) {
      console.error('Speech-to-Text error:', error);
      throw new Error('Failed to process speech');
    }
  }

  // Image Analysis using AI Vision
  async analyzeImage(imageBlob, analysisType = 'comprehensive') {
    try {
      // Convert image to base64
      const imageBase64 = await this.blobToBase64(imageBlob);
      
      const analysisPrompts = {
        basic: "Describe this image in detail, focusing on main objects and their spatial relationships.",
        comprehensive: "Analyze this image comprehensively, describing all visible objects, their colors, textures, shapes, lighting, and spatial relationships. Pay special attention to elements that would be important for 3D model generation.",
        objects: "Identify and list all distinct objects in this image, with their approximate positions and sizes relative to each other.",
        depth: "Analyze the depth and perspective in this image, describing what appears closest and farthest from the camera, and any depth cues like shadows, overlapping, or perspective."
      };

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-4-vision-preview",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: analysisPrompts[analysisType] || analysisPrompts.comprehensive },
            { type: "image_url", image_url: { url: imageBase64 } }
          ]
        }],
        max_tokens: 1000
      });

      return {
        description: response.data.choices[0].message.content,
        analysisType,
        confidence: 0.9 // AI vision confidence score
      };

    } catch (error) {
      console.error('Image analysis error:', error);
      throw new Error('Failed to analyze image');
    }
  }

  // Intent Recognition from Voice
  async analyzeVoiceIntent(transcription, context = {}) {
    try {
      const intentPrompt = `
        Analyze the following voice transcription and identify the user's intent for 3D model generation:
        
        Transcription: "${transcription}"
        Context: ${JSON.stringify(context)}
        
        Provide a JSON response with:
        {
          "intent": "create_3d|modify_3d|describe_3d|question_about_3d|other",
          "objects": ["array of objects mentioned"],
          "actions": ["array of actions or modifications requested"],
          "properties": {"color": "color mentioned", "size": "size mentioned", etc.},
          "confidence": 0.0-1.0,
          "keywords": ["array of important keywords"]
        }
      `;

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: intentPrompt }],
        max_tokens: 500
      });

      const result = JSON.parse(response.data.choices[0].message.content);
      return result;

    } catch (error) {
      console.error('Intent analysis error:', error);
      return {
        intent: 'other',
        objects: [],
        actions: [],
        properties: {},
        confidence: 0.5,
        keywords: []
      };
    }
  }

  // Enhanced 3D Description from Voice
  async enhanceVoiceDescription(transcription, intent, options = {}) {
    try {
      const enhancementPrompt = `
        Create a detailed 3D model description based on the following voice input:
        
        Original transcription: "${transcription}"
        Detected intent: ${intent.intent}
        Objects mentioned: ${intent.objects.join(', ')}
        Actions requested: ${intent.actions.join(', ')}
        Properties: ${JSON.stringify(intent.properties)}
        
        Create a comprehensive 3D model description that includes:
        1. Clear object definitions
        2. Spatial relationships
        3. Materials and textures
        4. Lighting and environment
        5. Technical specifications for 3D generation
        
        Format as detailed description suitable for 3D model generation.
      `;

      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: "gpt-4",
        messages: [{ role: "user", content: enhancementPrompt }],
        max_tokens: 800
      });

      return {
        original: transcription,
        enhanced: response.data.choices[0].message.content,
        intent: intent,
        technicalSpecs: this.extractTechnicalSpecs(response.data.choices[0].message.content)
      };

    } catch (error) {
      console.error('Description enhancement error:', error);
      return {
        original: transcription,
        enhanced: transcription,
        intent: intent,
        technicalSpecs: {}
      };
    }
  }

  // Object Detection in Images
  async detectObjectsInImage(imageAnalysis, options = {}) {
    try {
      // This would typically use computer vision APIs like Google Vision, AWS Rekognition, or custom models
      // For now, we'll simulate object detection from the AI analysis
      
      const objects = [];
      const description = imageAnalysis.description.toLowerCase();
      
      // Simple keyword-based object detection
      const objectKeywords = {
        'car': ['car', 'vehicle', 'automobile'],
        'house': ['house', 'building', 'home', 'structure'],
        'tree': ['tree', 'plant', 'vegetation'],
        'person': ['person', 'human', 'man', 'woman', 'child'],
        'chair': ['chair', 'seat', 'furniture'],
        'table': ['table', 'desk', 'surface'],
        'phone': ['phone', 'mobile', 'device'],
        'computer': ['computer', 'laptop', 'screen', 'monitor']
      };

      for (const [objectType, keywords] of Object.entries(objectKeywords)) {
        if (keywords.some(keyword => description.includes(keyword))) {
          objects.push({
            type: objectType,
            confidence: 0.8, // Simulated confidence
            position: this.estimateObjectPosition(description, keywords[0]),
            properties: this.extractObjectProperties(description, objectType)
          });
        }
      }

      return objects;

    } catch (error) {
      console.error('Object detection error:', error);
      return [];
    }
  }

  // Depth Estimation
  async estimateDepthMap(imageBlob, objects) {
    try {
      // This would use specialized depth estimation models
      // For now, we'll create a simple depth map based on object positions
      
      const depthMap = {
        width: 640,
        height: 480,
        depthData: [], // Simulated depth values
        objects: objects.map(obj => ({
          ...obj,
          estimatedDepth: Math.random() * 10 + 1 // 1-10 units
        }))
      };

      return depthMap;

    } catch (error) {
      console.error('Depth estimation error:', error);
      return null;
    }
  }

  // 3D Scene Reconstruction
  async reconstruct3DScene(objects, depthMap, imageAnalysis) {
    try {
      const scene = {
        id: uuidv4(),
        objects: objects.map(obj => ({
          id: uuidv4(),
          type: obj.type,
          position: this.calculateObjectPosition(obj, depthMap),
          rotation: [0, 0, 0], // Default rotation
          scale: this.calculateObjectScale(obj, imageAnalysis),
          material: this.estimateObjectMaterial(obj),
          geometry: this.generateObjectGeometry(obj)
        })),
        environment: {
          lighting: this.analyzeLighting(imageAnalysis.description),
          background: this.estimateBackground(imageAnalysis.description),
          atmosphere: this.estimateAtmosphere(imageAnalysis.description)
        },
        camera: {
          position: [0, 0, 5], // Default camera position
          target: [0, 0, 0],
          fov: 60
        }
      };

      return scene;

    } catch (error) {
      console.error('3D scene reconstruction error:', error);
      throw new Error('Failed to reconstruct 3D scene');
    }
  }

  // Generate 3D from Voice Description
  async generate3DFromVoice(description, options = {}) {
    try {
      // Use the existing 3D service to generate the model
      const threeDService = require('./threeDService');
      const result = await threeDService.generate3DModel(
        description.enhanced || description.original,
        {
          quality: options.quality || 'medium',
          style: options.style || 'realistic',
          format: options.format || 'glb'
        }
      );

      return result;

    } catch (error) {
      console.error('3D generation from voice error:', error);
      throw new Error('Failed to generate 3D model from voice');
    }
  }

  // Voice Command Processing
  async extractVoiceCommands(transcription) {
    const commands = [];
    const lowerTranscription = transcription.toLowerCase();
    
    // Command patterns
    const commandPatterns = {
      'create': ['create', 'make', 'build', 'generate'],
      'delete': ['delete', 'remove', 'delete'],
      'move': ['move', 'shift', 'translate'],
      'rotate': ['rotate', 'turn', 'spin'],
      'scale': ['resize', 'scale', 'bigger', 'smaller'],
      'color': ['color', 'colour', 'paint', 'red', 'blue', 'green'],
      'material': ['material', 'texture', 'surface', 'metal', 'wood', 'glass']
    };

    for (const [command, keywords] of Object.entries(commandPatterns)) {
      if (keywords.some(keyword => lowerTranscription.includes(keyword))) {
        commands.push({
          type: command,
          confidence: 0.8,
          parameters: this.extractCommandParameters(transcription, command)
        });
      }
    }

    return commands;
  }

  // Helper Methods
  updateJobProgress(jobId, progress, message) {
    const job = this.processingJobs.get(jobId);
    if (job) {
      job.progress = progress;
      job.currentStep = message;
      this.processingJobs.set(jobId, job);
    }
  }

  async blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        resolve(result.split(',')[1]); // Remove data URL prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  calculateSTTConfidence(segments) {
    if (!segments || segments.length === 0) return 0.5;
    const avgConfidence = segments.reduce((sum, seg) => sum + (seg.avg_logprob || 0), 0) / segments.length;
    return Math.max(0, Math.min(1, (avgConfidence + 1) / 1)); // Convert log probability to 0-1 scale
  }

  calculateVoiceConfidence(audioBlob, transcription) {
    const baseConfidence = transcription.length > 0 ? 0.8 : 0.1;
    const lengthBonus = Math.min(0.2, transcription.length / 1000);
    return Math.min(1.0, baseConfidence + lengthBonus);
  }

  calculateImageConfidence(imageBlob, objects) {
    const objectCount = objects.length;
    const baseScore = Math.min(0.8, objectCount * 0.2);
    return Math.min(1.0, baseScore);
  }

  extractTechnicalSpecs(description) {
    // Extract technical specifications from the enhanced description
    const specs = {
      complexity: 'medium',
      materials: [],
      lighting: 'natural',
      style: 'realistic'
    };

    // Simple keyword extraction (would be more sophisticated in production)
    if (description.includes('metal')) specs.materials.push('metal');
    if (description.includes('glass')) specs.materials.push('glass');
    if (description.includes('wood')) specs.materials.push('wood');
    if (description.includes('simple')) specs.complexity = 'low';
    if (description.includes('complex')) specs.complexity = 'high';

    return specs;
  }

  estimateObjectPosition(description, objectKeyword) {
    // Simple position estimation based on text
    const lowerDesc = description.toLowerCase();
    const position = [Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2];
    
    if (lowerDesc.includes('center') || lowerDesc.includes('middle')) {
      position[0] = 0; position[1] = 0;
    }
    if (lowerDesc.includes('left')) position[0] = -2;
    if (lowerDesc.includes('right')) position[0] = 2;
    if (lowerDesc.includes('top') || lowerDesc.includes('above')) position[1] = 2;
    if (lowerDesc.includes('bottom') || lowerDesc.includes('below')) position[1] = -2;

    return position;
  }

  extractObjectProperties(description, objectType) {
    const props = {
      color: null,
      size: null,
      material: null
    };

    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'black', 'white', 'gray'];
    const materials = ['metal', 'wood', 'glass', 'plastic', 'fabric'];
    
    colors.forEach(color => {
      if (description.toLowerCase().includes(color)) {
        props.color = color;
      }
    });

    materials.forEach(material => {
      if (description.toLowerCase().includes(material)) {
        props.material = material;
      }
    });

    return props;
  }

  calculateObjectPosition(obj, depthMap) {
    // Calculate 3D position from 2D position and depth
    const basePosition = obj.position || [0, 0, 0];
    const depth = obj.estimatedDepth || 5;
    return [basePosition[0], basePosition[1], -depth];
  }

  calculateObjectScale(obj, imageAnalysis) {
    // Estimate scale based on object type and description
    const baseScale = [1, 1, 1];
    
    if (obj.properties.size) {
      switch (obj.properties.size.toLowerCase()) {
        case 'small': return [0.5, 0.5, 0.5];
        case 'large': return [2, 2, 2];
        case 'tiny': return [0.2, 0.2, 0.2];
        case 'huge': return [3, 3, 3];
        default: return baseScale;
      }
    }

    return baseScale;
  }

  estimateObjectMaterial(obj) {
    const material = {
      type: 'standard',
      color: [0.7, 0.7, 0.7],
      roughness: 0.5,
      metalness: 0.0
    };

    if (obj.properties.material) {
      switch (obj.properties.material.toLowerCase()) {
        case 'metal':
          material.roughness = 0.1;
          material.metalness = 0.9;
          break;
        case 'glass':
          material.roughness = 0.0;
          material.metalness = 0.0;
          material.opacity = 0.8;
          break;
        case 'wood':
          material.color = [0.4, 0.2, 0.1];
          material.roughness = 0.8;
          break;
      }
    }

    if (obj.properties.color) {
      const colorMap = {
        'red': [1, 0, 0],
        'blue': [0, 0, 1],
        'green': [0, 1, 0],
        'yellow': [1, 1, 0],
        'purple': [1, 0, 1],
        'orange': [1, 0.5, 0],
        'black': [0, 0, 0],
        'white': [1, 1, 1]
      };
      if (colorMap[obj.properties.color]) {
        material.color = colorMap[obj.properties.color];
      }
    }

    return material;
  }

  generateObjectGeometry(obj) {
    // Generate basic geometry based on object type
    const geometries = {
      'cube': { type: 'box', size: [1, 1, 1] },
      'sphere': { type: 'sphere', radius: 0.5 },
      'cylinder': { type: 'cylinder', radius: 0.5, height: 1 },
      'cone': { type: 'cone', radius: 0.5, height: 1 },
      'plane': { type: 'plane', size: [1, 1] }
    };

    return geometries[obj.type] || geometries.cube;
  }

  analyzeLighting(description) {
    const lowerDesc = description.toLowerCase();
    if (lowerDesc.includes('bright') || lowerDesc.includes('sunny')) {
      return 'bright';
    } else if (lowerDesc.includes('dark') || lowerDesc.includes('night')) {
      return 'dark';
    } else if (lowerDesc.includes('soft') || lowerDesc.includes('diffused')) {
      return 'soft';
    }
    return 'natural';
  }

  estimateBackground(description) {
    if (description.toLowerCase().includes('studio') || description.toLowerCase().includes('white background')) {
      return 'studio';
    } else if (description.toLowerCase().includes('outdoor') || description.toLowerCase().includes('nature')) {
      return 'outdoor';
    }
    return 'neutral';
  }

  estimateAtmosphere(description) {
    if (description.toLowerCase().includes('foggy') || description.toLowerCase().includes('misty')) {
      return 'foggy';
    } else if (description.toLowerCase().includes('clear') || description.toLowerCase().includes('bright')) {
      return 'clear';
    }
    return 'normal';
  }

  extractCommandParameters(transcription, commandType) {
    const params = {};
    const lowerTrans = transcription.toLowerCase();
    
    switch (commandType) {
      case 'color':
        const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'black', 'white'];
        const foundColor = colors.find(color => lowerTrans.includes(color));
        if (foundColor) params.color = foundColor;
        break;
      
      case 'scale':
        if (lowerTrans.includes('bigger') || lowerTrans.includes('larger')) params.scale = 'increase';
        if (lowerTrans.includes('smaller') || lowerTrans.includes('smaller')) params.scale = 'decrease';
        break;
      
      case 'move':
        if (lowerTrans.includes('left')) params.direction = 'left';
        if (lowerTrans.includes('right')) params.direction = 'right';
        if (lowerTrans.includes('up')) params.direction = 'up';
        if (lowerTrans.includes('down')) params.direction = 'down';
        break;
    }
    
    return params;
  }

  // Get processing job status
  getJobStatus(jobId) {
    return this.processingJobs.get(jobId) || { error: 'Job not found' };
  }

  // Get all jobs for a user
  getUserJobs(userId) {
    const userJobs = [];
    for (const [jobId, job] of this.processingJobs.entries()) {
      if (job.userId === userId) {
        userJobs.push({ jobId, ...job });
      }
    }
    return userJobs;
  }

  // Cleanup old jobs
  cleanupOldJobs() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let cleaned = 0;

    for (const [jobId, job] of this.processingJobs.entries()) {
      if (new Date(job.startedAt) < oneHourAgo) {
        this.processingJobs.delete(jobId);
        cleaned++;
      }
    }

    console.log(`Cleaned up ${cleaned} old multimodal processing jobs`);
  }
}

module.exports = MultimodalService;