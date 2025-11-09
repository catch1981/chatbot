const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const FormData = require('form-data');

class ThreeDService {
  constructor() {
    this.supportedFormats = ['.glb', '.gltf', '.obj', '.fbx', '.stl'];
    this.generationQueue = new Map();
    this.modelCache = new Map();
    this.assetLibrary = new Map();
    
    // API configurations (can be environment variables)
    this.configs = {
      stability: {
        baseURL: 'https://api.stability.ai',
        model: 'stable-diffusion-xl-base-1.0'
      },
      replicate: {
        baseURL: 'https://api.replicate.com',
        model: 'stability-ai/stable-diffusion'
      },
      local: {
        enabled: process.env.LOCAL_3D_ENABLED === 'true',
        endpoint: process.env.LOCAL_3D_ENDPOINT || 'http://localhost:8000'
      }
    };
  }

  // Generate 3D model from text description
  async generate3DModel(description, options = {}) {
    try {
      const modelId = uuidv4();
      const generationRequest = {
        id: modelId,
        description: description.trim(),
        options: {
          quality: options.quality || 'medium',
          style: options.style || 'realistic',
          format: options.format || 'glb',
          complexity: options.complexity || 'medium',
          ...options
        },
        status: 'pending',
        createdAt: new Date().toISOString(),
        progress: 0
      };

      this.generationQueue.set(modelId, generationRequest);

      // Start async generation
      this.process3DGeneration(modelId, generationRequest);

      return {
        success: true,
        modelId: modelId,
        status: 'pending',
        estimatedTime: this.estimateGenerationTime(options.complexity || 'medium'),
        message: '3D model generation started'
      };

    } catch (error) {
      console.error('3D Model Generation Error:', error);
      throw new Error('Failed to start 3D model generation');
    }
  }

  // Process 3D generation (async)
  async process3DGeneration(modelId, request) {
    try {
      this.updateGenerationStatus(modelId, 'processing', 10);

      // Enhanced description for better results
      const enhancedDescription = await this.enhance3DDescription(request.description);
      this.updateGenerationStatus(modelId, 'processing', 25);

      // Generate 3D model using available API
      let modelData;
      try {
        if (this.configs.local.enabled) {
          modelData = await this.generateWithLocalAPI(enhancedDescription, request.options);
        } else {
          modelData = await this.generateWithExternalAPI(enhancedDescription, request.options);
        }
      } catch (apiError) {
        console.warn('External API failed, using procedural generation:', apiError);
        modelData = await this.generateProceduralModel(enhancedDescription, request.options);
      }

      this.updateGenerationStatus(modelId, 'processing', 75);

      // Save model data
      const savedModel = await this.save3DModel(modelId, modelData, request);
      this.updateGenerationStatus(modelId, 'processing', 90);

      // Generate thumbnail
      const thumbnail = await this.generateThumbnail(savedModel.filePath);
      savedModel.thumbnail = thumbnail;

      // Cache the model
      this.modelCache.set(modelId, savedModel);
      
      this.updateGenerationStatus(modelId, 'completed', 100, {
        modelId: modelId,
        filePath: savedModel.filePath,
        thumbnail: thumbnail,
        downloadUrl: `/api/3d/models/${modelId}/download`
      });

    } catch (error) {
      console.error('3D Generation Process Error:', error);
      this.updateGenerationStatus(modelId, 'failed', 0, {
        error: error.message
      });
    }
  }

  // Generate model using external API (Stability AI, Replicate, etc.)
  async generateWithExternalAPI(enhancedDescription, options) {
    // Placeholder for external API integration
    // In a real implementation, this would call APIs like:
    // - Stability AI for 3D generation
    // - Replicate for various 3D models
    // - Local model APIs
    
    console.log('Using external API for 3D generation...');
    console.log('Description:', enhancedDescription.enhancedDescription);
    console.log('Options:', options);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    return {
      vertices: this.generateProceduralVertices(enhancedDescription.enhancedDescription),
      faces: this.generateProceduralFaces(),
      materials: this.generateProceduralMaterials(enhancedDescription.enhancedDescription),
      format: options.format || 'glb',
      metadata: {
        description: enhancedDescription.enhancedDescription,
        generatedAt: new Date().toISOString(),
        generator: 'external-api',
        quality: options.quality
      }
    };
  }

  // Generate model using local API
  async generateWithLocalAPI(enhancedDescription, options) {
    try {
      const response = await axios.post(`${this.configs.local.endpoint}/generate-3d`, {
        description: enhancedDescription.enhancedDescription,
        options: options
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return response.data;

    } catch (error) {
      throw new Error(`Local API error: ${error.message}`);
    }
  }

  // Procedural 3D model generation (fallback)
  async generateProceduralModel(enhancedDescription, options) {
    const complexity = options.complexity || 'medium';
    const vertexCount = this.getVertexCountForComplexity(complexity);
    
    // Generate simple procedural geometry based on description
    const geometry = this.generateGeometryFromDescription(enhancedDescription.enhancedDescription, vertexCount);
    
    return {
      vertices: geometry.vertices,
      faces: geometry.faces,
      materials: geometry.materials,
      format: options.format || 'glb',
      metadata: {
        description: enhancedDescription.enhancedDescription,
        generatedAt: new Date().toISOString(),
        generator: 'procedural',
        quality: options.quality,
        complexity: complexity
      }
    };
  }

  // Generate geometry based on text description
  generateGeometryFromDescription(description, vertexCount) {
    const lowerDescription = description.toLowerCase();
    
    // Determine shape type from description
    let shapeType = 'cube';
    if (lowerDescription.includes('sphere') || lowerDescription.includes('ball') || lowerDescription.includes('round')) {
      shapeType = 'sphere';
    } else if (lowerDescription.includes('cylinder') || lowerDescription.includes('tube') || lowerDescription.includes('pipe')) {
      shapeType = 'cylinder';
    } else if (lowerDescription.includes('pyramid') || lowerDescription.includes('cone')) {
      shapeType = 'pyramid';
    } else if (lowerDescription.includes('plane') || lowerDescription.includes('flat') || lowerDescription.includes('surface')) {
      shapeType = 'plane';
    }

    return this.generateShape(shapeType, vertexCount, description);
  }

  // Generate basic shapes
  generateShape(shapeType, vertexCount, description) {
    const vertices = [];
    const faces = [];
    const materials = [{
      name: 'default',
      color: this.extractColorFromDescription(description) || [0.7, 0.7, 0.7],
      roughness: 0.5,
      metalness: 0.0
    }];

    switch (shapeType) {
      case 'sphere':
        return this.generateSphere(vertexCount);
      case 'cylinder':
        return this.generateCylinder(vertexCount);
      case 'pyramid':
        return this.generatePyramid();
      case 'plane':
        return this.generatePlane();
      default:
        return this.generateCube();
    }
  }

  generateSphere(vertexCount) {
    const vertices = [];
    const faces = [];
    const radius = 1;
    const segments = Math.sqrt(vertexCount);
    
    for (let lat = 0; lat <= segments; lat++) {
      for (let lon = 0; lon <= segments; lon++) {
        const phi = lat * Math.PI / segments;
        const theta = lon * 2 * Math.PI / segments;
        
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.cos(phi);
        const z = radius * Math.sin(phi) * Math.sin(theta);
        
        vertices.push([x, y, z]);
      }
    }
    
    for (let lat = 0; lat < segments; lat++) {
      for (let lon = 0; lon < segments; lon++) {
        const first = lat * (segments + 1) + lon;
        const second = first + segments + 1;
        
        faces.push([first, second, first + 1]);
        faces.push([second, second + 1, first + 1]);
      }
    }
    
    return { vertices, faces, materials: this.getDefaultMaterials() };
  }

  generateCube() {
    return {
      vertices: [
        [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
        [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
      ],
      faces: [
        [0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4],
        [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]
      ],
      materials: this.getDefaultMaterials()
    };
  }

  generateCylinder(vertexCount) {
    const vertices = [];
    const faces = [];
    const radius = 1;
    const height = 2;
    const segments = 8;
    
    // Top and bottom circles
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * 2 * Math.PI;
      const x = radius * Math.cos(angle);
      const z = radius * Math.sin(angle);
      
      vertices.push([x, height/2, z]);
      vertices.push([x, -height/2, z]);
    }
    
    // Center points
    vertices.push([0, height/2, 0]);
    vertices.push([0, -height/2, 0]);
    
    // Generate faces
    for (let i = 0; i < segments; i++) {
      const top1 = i * 2;
      const bottom1 = i * 2 + 1;
      const top2 = (i + 1) * 2;
      const bottom2 = (i + 1) * 2 + 1;
      
      // Side faces
      faces.push([top1, top2, bottom2, bottom1]);
    }
    
    return { vertices, faces, materials: this.getDefaultMaterials() };
  }

  generatePyramid() {
    return {
      vertices: [
        [-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [0, 1, 0]
      ],
      faces: [
        [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4], [0, 1, 2, 3]
      ],
      materials: this.getDefaultMaterials()
    };
  }

  generatePlane() {
    return {
      vertices: [
        [-2, 0, -2], [2, 0, -2], [2, 0, 2], [-2, 0, 2]
      ],
      faces: [[0, 1, 2, 3]],
      materials: this.getDefaultMaterials()
    };
  }

  // Get vertex count based on complexity
  getVertexCountForComplexity(complexity) {
    const counts = {
      low: 50,
      medium: 200,
      high: 500,
      ultra: 1000
    };
    return counts[complexity] || counts.medium;
  }

  // Extract color hints from description
  extractColorFromDescription(description) {
    const colorMap = {
      'red': [1, 0, 0],
      'blue': [0, 0, 1],
      'green': [0, 1, 0],
      'yellow': [1, 1, 0],
      'purple': [1, 0, 1],
      'orange': [1, 0.5, 0],
      'white': [1, 1, 1],
      'black': [0, 0, 0],
      'gray': [0.5, 0.5, 0.5]
    };
    
    const lowerDesc = description.toLowerCase();
    for (const [color, rgb] of Object.entries(colorMap)) {
      if (lowerDesc.includes(color)) {
        return rgb;
      }
    }
    return null;
  }

  // Enhance 3D description
  async enhance3DDescription(description) {
    // Use AI service to enhance description
    // For now, return basic enhancement
    return {
      enhancedDescription: description,
      visualCharacteristics: [],
      style: "realistic",
      technicalSpecs: {}
    };
  }

  // Save 3D model to file
  async save3DModel(modelId, modelData, request) {
    const modelsDir = path.join(__dirname, '../../uploads/3d-models');
    await fs.mkdir(modelsDir, { recursive: true });
    
    const fileName = `${modelId}.${modelData.format}`;
    const filePath = path.join(modelsDir, fileName);
    
    // Convert model data to GLB format (simplified)
    const glbContent = this.convertToGLB(modelData);
    await fs.writeFile(filePath, glbContent);
    
    return {
      id: modelId,
      filePath: filePath,
      fileName: fileName,
      format: modelData.format,
      size: glbContent.length,
      metadata: modelData.metadata,
      createdAt: new Date().toISOString()
    };
  }

  // Convert model data to GLB format (simplified)
  convertToGLB(modelData) {
    // This is a simplified GLB conversion
    // In a real implementation, you would use proper 3D libraries
    return JSON.stringify({
      asset: {
        version: "2.0",
        generator: "AI 3D Generator"
      },
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0 }],
      meshes: [{
        primitives: [{
          attributes: {
            POSITION: modelData.vertices.flat()
          },
          indices: modelData.faces.flat()
        }]
      }],
      metadata: modelData.metadata
    });
  }

  // Generate thumbnail for 3D model
  async generateThumbnail(filePath) {
    // In a real implementation, you would:
    // 1. Load the 3D model
    // 2. Render it to a 2D image
    // 3. Save as thumbnail
    
    // For now, return a placeholder
    return `/uploads/3d-models/thumbnails/${path.basename(filePath, path.extname(filePath))}.png`;
  }

  // Get generation status
  getGenerationStatus(modelId) {
    return this.generationQueue.get(modelId);
  }

  // Update generation status
  updateGenerationStatus(modelId, status, progress, data = {}) {
    if (this.generationQueue.has(modelId)) {
      const request = this.generationQueue.get(modelId);
      request.status = status;
      request.progress = progress;
      request.data = data;
      request.updatedAt = new Date().toISOString();
      this.generationQueue.set(modelId, request);
    }
  }

  // Estimate generation time
  estimateGenerationTime(complexity) {
    const times = {
      low: 30,
      medium: 60,
      high: 120,
      ultra: 300
    };
    return times[complexity] || times.medium;
  }

  // Get default materials
  getDefaultMaterials() {
    return [{
      name: 'default',
      color: [0.7, 0.7, 0.7],
      roughness: 0.5,
      metalness: 0.0
    }];
  }

  // Procedural generation helpers
  generateProceduralVertices(description) {
    // Generate random vertices based on description
    const count = this.getVertexCountForComplexity('medium');
    const vertices = [];
    
    for (let i = 0; i < count; i++) {
      vertices.push([
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ]);
    }
    
    return vertices;
  }

  generateProceduralFaces() {
    const faces = [];
    const vertexCount = 50;
    
    for (let i = 0; i < vertexCount / 3; i++) {
      faces.push([
        Math.floor(Math.random() * vertexCount),
        Math.floor(Math.random() * vertexCount),
        Math.floor(Math.random() * vertexCount)
      ]);
    }
    
    return faces;
  }

  generateProceduralMaterials(description) {
    const color = this.extractColorFromDescription(description) || [0.7, 0.7, 0.7];
    
    return [{
      name: 'procedural',
      color: color,
      roughness: 0.5 + Math.random() * 0.3,
      metalness: Math.random() * 0.2
    }];
  }

  // Asset management
  getAssetLibrary() {
    return Array.from(this.assetLibrary.values());
  }

  addToAssetLibrary(modelData) {
    const assetId = uuidv4();
    this.assetLibrary.set(assetId, {
      id: assetId,
      ...modelData,
      addedAt: new Date().toISOString()
    });
    return assetId;
  }

  // Clean up old generations
  cleanup() {
    const now = new Date();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [modelId, request] of this.generationQueue.entries()) {
      if (now - new Date(request.createdAt) > maxAge && request.status === 'completed') {
        this.generationQueue.delete(modelId);
        this.modelCache.delete(modelId);
      }
    }
  }
}

module.exports = ThreeDService;