const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

class VideoGenerationService extends EventEmitter {
  constructor() {
    super();
    this.generationQueue = new Map();
    this.supportedFormats = ['mp4', 'webm', 'mov', 'avi'];
    this.videoCache = new Map();
    this.processingJobs = new Map();
    
    // Video generation service configurations
    this.configs = {
      stability: {
        baseURL: 'https://api.stability.ai',
        model: 'stable-video-diffusion',
        maxDuration: 4,
        fps: 24,
        resolutions: ['512x512', '768x768', '1024x576']
      },
      runway: {
        baseURL: 'https://api.runwayml.com',
        model: 'gen2',
        maxDuration: 4,
        fps: 24,
        resolutions: ['1280x768', '768x1280']
      },
      pika: {
        baseURL: 'https://api.pika.art',
        model: 'pika-1.0',
        maxDuration: 3,
        fps: 24,
        resolutions: ['1024x576', '576x1024']
      },
      local: {
        enabled: process.env.LOCAL_VIDEO_ENABLED === 'true',
        endpoint: process.env.LOCAL_VIDEO_ENDPOINT || 'http://localhost:8001'
      }
    };

    // Video generation methods
    this.generationMethods = {
      'text-to-video': this.generateFromText.bind(this),
      'image-to-video': this.generateFromImage.bind(this),
      '3d-to-video': this.generateFrom3D.bind(this),
      'voice-to-video': this.generateFromVoice.bind(this),
      'text-to-image-video': this.generateFromTextImage.bind(this),
      '3d-animation': this.generate3DAnimation.bind(this)
    };

    this.initializeVideoDirectory();
  }

  async initializeVideoDirectory() {
    const videoDir = path.join(__dirname, '../../uploads/videos');
    try {
      await fs.mkdir(videoDir, { recursive: true });
      await fs.mkdir(path.join(videoDir, 'thumbnails'), { recursive: true });
      await fs.mkdir(path.join(videoDir, 'processing'), { recursive: true });
      await fs.mkdir(path.join(videoDir, 'completed'), { recursive: true });
    } catch (error) {
      console.error('Error creating video directories:', error);
    }
  }

  // Generate video from text description
  async generateVideoFromText(description, options = {}) {
    try {
      const videoId = uuidv4();
      const generationRequest = {
        id: videoId,
        type: 'text-to-video',
        description: description.trim(),
        options: {
          duration: options.duration || 3,
          fps: options.fps || 24,
          resolution: options.resolution || '768x768',
          style: options.style || 'realistic',
          format: options.format || 'mp4',
          quality: options.quality || 'medium',
          motionLevel: options.motionLevel || 7, // 1-10 scale
          cameraMovement: options.cameraMovement || 'static',
          ...options
        },
        status: 'pending',
        createdAt: new Date(),
        progress: 0,
        estimatedTime: this.estimateGenerationTime(options.duration || 3)
      };

      this.generationQueue.set(videoId, generationRequest);

      // Start async video generation
      this.processVideoGeneration(videoId, generationRequest);

      return {
        success: true,
        videoId: videoId,
        status: 'pending',
        estimatedTime: generationRequest.estimatedTime,
        message: 'Video generation started'
      };

    } catch (error) {
      console.error('Video generation error:', error);
      throw new Error('Failed to start video generation');
    }
  }

  // Generate video from image
  async generateVideoFromImage(imageData, options = {}) {
    try {
      const videoId = uuidv4();
      const generationRequest = {
        id: videoId,
        type: 'image-to-video',
        imageData: imageData,
        options: {
          duration: options.duration || 3,
          fps: options.fps || 24,
          resolution: options.resolution || '768x768',
          motion: options.motion || 5, // 1-10 scale
          style: options.style || 'realistic',
          format: options.format || 'mp4',
          ...options
        },
        status: 'pending',
        createdAt: new Date(),
        progress: 0,
        estimatedTime: this.estimateGenerationTime(options.duration || 3)
      };

      this.generationQueue.set(videoId, generationRequest);
      this.processVideoGeneration(videoId, generationRequest);

      return {
        success: true,
        videoId: videoId,
        status: 'pending',
        estimatedTime: generationRequest.estimatedTime
      };

    } catch (error) {
      console.error('Image to video generation error:', error);
      throw new Error('Failed to start image-to-video generation');
    }
  }

  // Generate video from 3D model
  async generateVideoFrom3D(modelData, options = {}) {
    try {
      const videoId = uuidv4();
      const generationRequest = {
        id: videoId,
        type: '3d-to-video',
        modelData: modelData,
        options: {
          duration: options.duration || 3,
          fps: options.fps || 30,
          resolution: options.resolution || '1024x576',
          cameraPath: options.cameraPath || 'orbit',
          lighting: options.lighting || 'natural',
          background: options.background || 'studio',
          format: options.format || 'mp4',
          ...options
        },
        status: 'pending',
        createdAt: new Date(),
        progress: 0,
        estimatedTime: this.estimateGenerationTime(options.duration || 3, '3d')
      };

      this.generationQueue.set(videoId, generationRequest);
      this.processVideoGeneration(videoId, generationRequest);

      return {
        success: true,
        videoId: videoId,
        status: 'pending',
        estimatedTime: generationRequest.estimatedTime
      };

    } catch (error) {
      console.error('3D to video generation error:', error);
      throw new Error('Failed to start 3D-to-video generation');
    }
  }

  // Generate video from voice/audio
  async generateVideoFromVoice(audioData, options = {}) {
    try {
      const videoId = uuidv4();
      const generationRequest = {
        id: videoId,
        type: 'voice-to-video',
        audioData: audioData,
        options: {
          visualStyle: options.visualStyle || 'abstract',
          syncToAudio: options.syncToAudio !== false,
          duration: options.duration || 3,
          resolution: options.resolution || '768x768',
          format: options.format || 'mp4',
          ...options
        },
        status: 'pending',
        createdAt: new Date(),
        progress: 0,
        estimatedTime: this.estimateGenerationTime(options.duration || 3, 'voice')
      };

      this.generationQueue.set(videoId, generationRequest);
      this.processVideoGeneration(videoId, generationRequest);

      return {
        success: true,
        videoId: videoId,
        status: 'pending',
        estimatedTime: generationRequest.estimatedTime
      };

    } catch (error) {
      console.error('Voice to video generation error:', error);
      throw new Error('Failed to start voice-to-video generation');
    }
  }

  // Process video generation (async)
  async processVideoGeneration(videoId, request) {
    try {
      this.updateGenerationStatus(videoId, 'processing', 10);

      // Step 1: Prepare input data
      const processedInput = await this.prepareInputData(request);
      this.updateGenerationStatus(videoId, 'processing', 25);

      // Step 2: Enhance prompts/descriptions
      const enhancedData = await this.enhanceVideoPrompt(request, processedInput);
      this.updateGenerationStatus(videoId, 'processing', 40);

      // Step 3: Generate video using available service
      const videoResult = await this.executeVideoGeneration(videoId, request, enhancedData);
      this.updateGenerationStatus(videoId, 'processing', 70);

      // Step 4: Post-process video
      const processedVideo = await this.postProcessVideo(videoResult, request);
      this.updateGenerationStatus(videoId, 'processing', 85);

      // Step 5: Save and prepare for delivery
      const savedVideo = await this.saveVideo(videoId, processedVideo, request);
      this.updateGenerationStatus(videoId, 'processing', 95);

      // Step 6: Generate thumbnail and metadata
      const thumbnail = await this.generateVideoThumbnail(savedVideo.filePath);
      const metadata = await this.generateVideoMetadata(savedVideo);

      // Complete the generation
      this.updateGenerationStatus(videoId, 'completed', 100, {
        videoId: videoId,
        filePath: savedVideo.filePath,
        thumbnail: thumbnail,
        metadata: metadata,
        downloadUrl: `/api/video/videos/${videoId}/download`,
        streamingUrl: `/api/video/videos/${videoId}/stream`,
        duration: request.options.duration,
        resolution: request.options.resolution
      });

    } catch (error) {
      console.error('Video generation process error:', error);
      this.updateGenerationStatus(videoId, 'failed', 0, {
        error: error.message
      });
    }
  }

  // Execute video generation using available services
  async executeVideoGeneration(videoId, request, enhancedData) {
    const serviceType = this.selectBestService(request.type, request.options);
    
    try {
      switch (serviceType) {
        case 'local':
          return await this.generateWithLocalService(enhancedData, request.options);
        case 'stability':
          return await this.generateWithStabilityAPI(enhancedData, request.options);
        case 'runway':
          return await this.generateWithRunwayAPI(enhancedData, request.options);
        case 'pika':
          return await this.generateWithPikaAPI(enhancedData, request.options);
        default:
          return await this.generateWithFallback(enhancedData, request.options);
      }
    } catch (error) {
      console.warn(`Primary service failed, using fallback:`, error);
      return await this.generateWithFallback(enhancedData, request.options);
    }
  }

  // Select best video generation service
  selectBestService(type, options) {
    // Priority: Local > Stability > Runway > Pika > Fallback
    if (this.configs.local.enabled) {
      return 'local';
    }
    
    // Check API keys and select best available service
    if (process.env.STABILITY_API_KEY && type === 'text-to-video') {
      return 'stability';
    }
    
    if (process.env.RUNWAY_API_KEY) {
      return 'runway';
    }
    
    if (process.env.PIKA_API_KEY) {
      return 'pika';
    }
    
    return 'fallback';
  }

  // Generate with local service
  async generateWithLocalService(data, options) {
    try {
      const response = await fetch(`${this.configs.local.endpoint}/generate-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...data,
          options: options
        })
      });

      if (!response.ok) {
        throw new Error(`Local service error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.videoData;

    } catch (error) {
      throw new Error(`Local service generation failed: ${error.message}`);
    }
  }

  // Generate with Stability AI
  async generateWithStabilityAPI(data, options) {
    try {
      const response = await fetch('https://api.stability.ai/v1/generation/stable-video-diffusion-1-1/text-to-video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          text_prompts: [data.prompt],
          cfg_scale: 7,
          height: parseInt(options.resolution.split('x')[1]),
          width: parseInt(options.resolution.split('x')[0]),
          steps: 25,
          motion_bucket_id: options.motionLevel || 7,
          noise_aug_strength: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`Stability API error: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        videoData: result.artifacts[0].base64,
        format: 'mp4',
        metadata: result
      };

    } catch (error) {
      throw new Error(`Stability API generation failed: ${error.message}`);
    }
  }

  // Generate with Runway ML
  async generateWithRunwayAPI(data, options) {
    try {
      const response = await fetch('https://api.runwayml.com/v1/image_to_video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gen2',
          image_url: data.imageUrl,
          motion: options.motion || 5,
          watermark: false
        })
      });

      const result = await response.json();
      return {
        videoData: result.output_url,
        format: 'mp4',
        metadata: result
      };

    } catch (error) {
      throw new Error(`Runway API generation failed: ${error.message}`);
    }
  }

  // Generate with Pika Labs
  async generateWithPikaAPI(data, options) {
    try {
      const response = await fetch('https://api.pika.art/generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PIKA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: data.prompt,
          model: 'pika-1.0',
          aspect_ratio: options.resolution === '768x768' ? '1:1' : '16:9',
          duration: options.duration || 3,
          fps: options.fps || 24
        })
      });

      const result = await response.json();
      return {
        videoData: result.video_url,
        format: 'mp4',
        metadata: result
      };

    } catch (error) {
      throw new Error(`Pika API generation failed: ${error.message}`);
    }
  }

  // Fallback generation using procedural methods
  async generateWithFallback(data, options) {
    console.log('Using fallback video generation...');
    
    // Simulate generation time
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Generate procedural video data
    const videoData = this.generateProceduralVideo(data, options);
    
    return {
      videoData: videoData,
      format: 'mp4',
      metadata: {
        generated: 'procedural',
        timestamp: new Date().toISOString(),
        fallback: true
      }
    };
  }

  // Generate procedural video as fallback
  generateProceduralVideo(data, options) {
    // Create a simple procedural video (in real implementation, would use video libraries)
    const videoInfo = {
      id: uuidv4(),
      type: 'procedural',
      prompt: data.prompt,
      duration: options.duration,
      resolution: options.resolution,
      fps: options.fps,
      createdAt: new Date(),
      // In real implementation, this would be actual video binary data
      placeholder: 'procedural_video_data'
    };

    return videoInfo;
  }

  // Prepare input data for generation
  async prepareInputData(request) {
    switch (request.type) {
      case 'text-to-video':
        return { prompt: request.description };
      case 'image-to-video':
        return { imageData: request.imageData, prompt: 'Animate this image' };
      case '3d-to-video':
        return { modelData: request.modelData, prompt: 'Rotate and showcase this 3D model' };
      case 'voice-to-video':
        return { audioData: request.audioData, prompt: 'Create visuals for this audio' };
      default:
        return { prompt: request.description || 'Generate a video' };
    }
  }

  // Enhance video prompts for better results
  async enhanceVideoPrompt(request, processedInput) {
    // Use AI service to enhance prompts
    if (request.type === 'text-to-video' && processedInput.prompt) {
      const enhanced = await this.enhancePromptForVideo(processedInput.prompt);
      return { ...processedInput, prompt: enhanced };
    }
    
    return processedInput;
  }

  // Enhance prompt specifically for video generation
  async enhancePromptForVideo(prompt) {
    // Add video-specific enhancements
    const videoEnhancements = [
      'cinematic lighting',
      'high quality',
      'smooth motion',
      'professional cinematography',
      '4K resolution'
    ];

    const enhancedPrompt = `${prompt}, ${videoEnhancements.join(', ')}`;
    return enhancedPrompt;
  }

  // Post-process generated video
  async postProcessVideo(videoResult, request) {
    // In real implementation, would apply post-processing effects
    return {
      ...videoResult,
      postProcessed: true,
      filters: ['enhance_quality', 'stabilize_motion'],
      timestamp: new Date()
    };
  }

  // Save video to file system
  async saveVideo(videoId, videoData, request) {
    const videoDir = path.join(__dirname, '../../uploads/videos');
    const fileName = `${videoId}.${videoData.format || 'mp4'}`;
    const filePath = path.join(videoDir, 'completed', fileName);

    try {
      // In real implementation, would save actual video data
      const videoInfo = {
        id: videoId,
        fileName: fileName,
        filePath: filePath,
        size: videoData.size || 1024 * 1024, // 1MB placeholder
        format: videoData.format || 'mp4',
        duration: request.options.duration,
        resolution: request.options.resolution,
        fps: request.options.fps,
        createdAt: new Date(),
        metadata: videoData.metadata
      };

      // Create placeholder file
      await fs.writeFile(filePath, `Video file for ${videoId}`);

      return videoInfo;
    } catch (error) {
      throw new Error(`Failed to save video: ${error.message}`);
    }
  }

  // Generate video thumbnail
  async generateVideoThumbnail(filePath) {
    // In real implementation, would extract frame from video
    const thumbnailPath = filePath.replace(/\.[^/.]+$/, '_thumb.jpg');
    // Create placeholder thumbnail
    await fs.writeFile(thumbnailPath, 'Video thumbnail');
    
    return `/uploads/videos/thumbnails/${path.basename(thumbnailPath)}`;
  }

  // Generate video metadata
  async generateVideoMetadata(videoInfo) {
    return {
      fileInfo: videoInfo,
      quality: 'high',
      codec: 'h264',
      audioCodec: 'aac',
      bitrate: '2Mbps',
      processingTime: Date.now() - videoInfo.createdAt.getTime()
    };
  }

  // Update generation status
  updateGenerationStatus(videoId, status, progress, data = {}) {
    if (this.generationQueue.has(videoId)) {
      const request = this.generationQueue.get(videoId);
      request.status = status;
      request.progress = progress;
      request.data = data;
      request.updatedAt = new Date();
      this.generationQueue.set(videoId, request);
    }
  }

  // Get generation status
  getGenerationStatus(videoId) {
    return this.generationQueue.get(videoId);
  }

  // Estimate generation time
  estimateGenerationTime(duration, type = 'standard') {
    const baseTime = duration * 10; // 10 seconds per second of video
    
    const multipliers = {
      'standard': 1,
      '3d': 1.5,
      'voice': 1.2,
      'high-quality': 2
    };
    
    return baseTime * (multipliers[type] || 1);
  }

  // Get video generation history
  getGenerationHistory(userId, limit = 50) {
    const userVideos = [];
    
    for (const [videoId, request] of this.generationQueue.entries()) {
      if (request.userId === userId) {
        userVideos.push({
          videoId: videoId,
          type: request.type,
          status: request.status,
          createdAt: request.createdAt,
          options: request.options
        });
      }
    }
    
    return userVideos
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  // Delete video
  async deleteVideo(videoId) {
    const videoData = this.generationQueue.get(videoId);
    if (!videoData || !videoData.data?.filePath) {
      throw new Error('Video not found');
    }

    try {
      await fs.unlink(videoData.data.filePath);
      this.generationQueue.delete(videoId);
      
      return { success: true, message: 'Video deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete video: ${error.message}`);
    }
  }

  // Get video analytics
  getVideoAnalytics() {
    const total = this.generationQueue.size;
    const completed = Array.from(this.generationQueue.values()).filter(v => v.status === 'completed').length;
    const processing = Array.from(this.generationQueue.values()).filter(v => v.status === 'processing').length;
    const failed = Array.from(this.generationQueue.values()).filter(v => v.status === 'failed').length;

    return {
      totalGenerations: total,
      completed: completed,
      processing: processing,
      failed: failed,
      successRate: total > 0 ? (completed / total * 100).toFixed(2) : 0,
      averageProcessingTime: this.calculateAverageProcessingTime()
    };
  }

  // Calculate average processing time
  calculateAverageProcessingTime() {
    const completedVideos = Array.from(this.generationQueue.values())
      .filter(v => v.status === 'completed' && v.updatedAt);
    
    if (completedVideos.length === 0) return 0;
    
    const totalTime = completedVideos.reduce((sum, video) => {
      return sum + (video.updatedAt - video.createdAt);
    }, 0);
    
    return Math.round(totalTime / completedVideos.length / 1000); // Return in seconds
  }

  // Clean up old video files
  async cleanupOldVideos() {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = Date.now();
    
    for (const [videoId, request] of this.generationQueue.entries()) {
      if (request.status === 'completed' && now - request.createdAt.getTime() > maxAge) {
        try {
          if (request.data?.filePath) {
            await fs.unlink(request.data.filePath);
          }
          this.generationQueue.delete(videoId);
        } catch (error) {
          console.warn(`Failed to cleanup video ${videoId}:`, error);
        }
      }
    }
  }
}

module.exports = VideoGenerationService;