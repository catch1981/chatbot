require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
// Import new services
const AIService = require('./services/aiService');
const ThreeDService = require('./services/threeDService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Import video generation service
const VideoGenerationService = require('./services/videoGenerationService');

// Initialize services
const aiService = new AIService();
const threeDService = new ThreeDService();
const videoGenerationService = new VideoGenerationService();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// In-memory storage (replace with database in production)
const users = new Map();
const conversations = new Map();
const videoRooms = new Map();

// Serve static files for uploaded content
const uploadsPath = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// User registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (users.has(username)) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    
    const user = {
      id: userId,
      username,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      isOnline: false
    };

    users.set(username, user);

    const token = jwt.sign(
      { userId, username, email },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: userId, username, email, createdAt: user.createdAt }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = users.get(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update online status
    user.isOnline = true;
    user.lastSeen = new Date().toISOString();

    const token = jwt.sign(
      { userId: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET || 'fallback-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        createdAt: user.createdAt,
        isOnline: user.isOnline 
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user profile
app.get('/api/user/profile', authenticateToken, (req, res) => {
  const user = users.get(req.user.username);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
    isOnline: user.isOnline,
    lastSeen: user.lastSeen
  });
});

// Chat API endpoints
app.post('/api/chat/send', authenticateToken, (req, res) => {
  try {
    const { message, conversationId } = req.body;
    const { userId, username } = req.user;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const chatMessage = {
      id: uuidv4(),
      userId,
      username,
      message: message.trim(),
      timestamp: new Date().toISOString(),
      type: 'text'
    };

    // If no conversationId provided, create new conversation
    let convId = conversationId;
    if (!convId) {
      convId = uuidv4();
      conversations.set(convId, {
        id: convId,
        participants: [userId],
        messages: [],
        createdAt: new Date().toISOString()
      });
    }

    const conversation = conversations.get(convId);
    if (conversation) {
      conversation.messages.push(chatMessage);
      
      // Emit to all clients in the conversation
      io.to(convId).emit('new_message', {
        conversationId: convId,
        message: chatMessage
      });
    }

    res.json({
      success: true,
      messageId: chatMessage.id,
      conversationId: convId,
      timestamp: chatMessage.timestamp
    });

  } catch (error) {
    console.error('Chat send error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get conversation history
app.get('/api/chat/conversations/:conversationId', authenticateToken, (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = conversations.get(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({
      conversationId,
      messages: conversation.messages,
      participants: conversation.participants,
      createdAt: conversation.createdAt
    });

  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// Video call endpoints
app.post('/api/video/create-room', authenticateToken, (req, res) => {
  try {
    const roomId = uuidv4();
    const { userId, username } = req.user;

    videoRooms.set(roomId, {
      id: roomId,
      host: userId,
      participants: [userId],
      createdAt: new Date().toISOString(),
      isActive: true
    });

    res.json({
      roomId,
      message: 'Video room created successfully',
      host: username
    });

  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create video room' });
  }
});

// Join video room
app.post('/api/video/join-room', authenticateToken, (req, res) => {
  try {
    const { roomId } = req.body;
    const { userId, username } = req.user;

    const room = videoRooms.get(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Video room not found' });
    }

    if (!room.participants.includes(userId)) {
      room.participants.push(userId);
    }

    res.json({
      roomId,
      participants: room.participants,
      message: 'Joined video room successfully'
    });

  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Failed to join video room' });
  }
});

// Get room info
app.get('/api/video/room/:roomId', authenticateToken, (req, res) => {
  try {
    const { roomId } = req.params;
    const room = videoRooms.get(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Video room not found' });
    }

    res.json({
      roomId,
      host: room.host,
      participants: room.participants,
      createdAt: room.createdAt,
      isActive: room.isActive
    });

  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to get room info' });
  }
});

// AI-powered chat endpoint
app.post('/api/ai/chat', authenticateToken, async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    const { userId, username } = req.user;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    // Generate AI response
    const user = users.get(username);
    const aiResponse = await aiService.generateResponse(
      message.trim(), 
      conversationId, 
      user ? { preferences: user.preferences } : {}
    );

    // Create AI message
    const aiMessage = {
      id: aiResponse.id,
      userId: 'ai-assistant',
      username: 'AI Assistant',
      message: aiResponse.content,
      timestamp: aiResponse.timestamp,
      type: 'ai_response',
      metadata: aiResponse.metadata
    };

    // If no conversationId provided, create new conversation
    let convId = conversationId;
    if (!convId) {
      convId = uuidv4();
      conversations.set(convId, {
        id: convId,
        participants: [userId, 'ai-assistant'],
        messages: [],
        createdAt: new Date().toISOString()
      });
    }

    const conversation = conversations.get(convId);
    if (conversation) {
      conversation.messages.push(aiMessage);
      
      // Emit AI response to all clients in the conversation
      io.to(convId).emit('ai_response', {
        conversationId: convId,
        message: aiMessage
      });
    }

    res.json({
      success: true,
      aiResponse: aiMessage,
      conversationId: convId
    });

  } catch (error) {
    console.error('AI Chat error:', error);
    res.status(500).json({ error: 'Failed to generate AI response' });
  }
});

// 3D Model Generation endpoint
app.post('/api/3d/generate', authenticateToken, async (req, res) => {
  try {
    const { description, options = {} } = req.body;
    const { userId, username } = req.user;

    if (!description || !description.trim()) {
      return res.status(400).json({ error: '3D model description is required' });
    }

    // Generate 3D model
    const generationResult = await threeDService.generate3DModel(
      description.trim(),
      {
        quality: options.quality || 'medium',
        style: options.style || 'realistic',
        format: options.format || 'glb',
        complexity: options.complexity || 'medium'
      }
    );

    res.json({
      success: true,
      generationId: generationResult.modelId,
      status: generationResult.status,
      estimatedTime: generationResult.estimatedTime,
      message: generationResult.message
    });

  } catch (error) {
    console.error('3D Generation error:', error);
    res.status(500).json({ error: 'Failed to generate 3D model' });
  }
});

// Video Generation API endpoints
app.post('/api/video/generate-text', authenticateToken, async (req, res) => {
  try {
    const { description, options = {} } = req.body;
    const { userId, username } = req.user;

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Video description is required' });
    }

    const result = await videoGenerationService.generateVideoFromText(
      description.trim(),
      {
        duration: options.duration || 3,
        fps: options.fps || 24,
        resolution: options.resolution || '768x768',
        style: options.style || 'realistic',
        format: options.format || 'mp4',
        quality: options.quality || 'medium'
      }
    );

    res.json({
      success: true,
      videoId: result.videoId,
      status: result.status,
      estimatedTime: result.estimatedTime,
      message: result.message
    });

  } catch (error) {
    console.error('Video generation error:', error);
    res.status(500).json({ error: 'Failed to generate video' });
  }
});

// Generate video from image
app.post('/api/video/generate-image', authenticateToken, async (req, res) => {
  try {
    const { imageData, options = {} } = req.body;
    const { userId } = req.user;

    if (!imageData) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    const result = await videoGenerationService.generateVideoFromImage(
      imageData,
      {
        duration: options.duration || 3,
        fps: options.fps || 24,
        resolution: options.resolution || '768x768',
        motion: options.motion || 5,
        style: options.style || 'realistic',
        format: options.format || 'mp4'
      }
    );

    res.json({
      success: true,
      videoId: result.videoId,
      status: result.status,
      estimatedTime: result.estimatedTime
    });

  } catch (error) {
    console.error('Image to video generation error:', error);
    res.status(500).json({ error: 'Failed to generate video from image' });
  }
});

// Generate video from 3D model
app.post('/api/video/generate-3d', authenticateToken, async (req, res) => {
  try {
    const { modelData, options = {} } = req.body;
    const { userId } = req.user;

    if (!modelData) {
      return res.status(400).json({ error: '3D model data is required' });
    }

    const result = await videoGenerationService.generateVideoFrom3D(
      modelData,
      {
        duration: options.duration || 3,
        fps: options.fps || 30,
        resolution: options.resolution || '1024x576',
        cameraPath: options.cameraPath || 'orbit',
        lighting: options.lighting || 'natural',
        background: options.background || 'studio',
        format: options.format || 'mp4'
      }
    );

    res.json({
      success: true,
      videoId: result.videoId,
      status: result.status,
      estimatedTime: result.estimatedTime
    });

  } catch (error) {
    console.error('3D to video generation error:', error);
    res.status(500).json({ error: 'Failed to generate video from 3D model' });
  }
});

// Get video generation status
app.get('/api/video/status/:videoId', authenticateToken, (req, res) => {
  try {
    const { videoId } = req.params;
    const status = videoGenerationService.getGenerationStatus(videoId);

    if (!status) {
      return res.status(404).json({ error: 'Video generation not found' });
    }

    res.json({
      success: true,
      status: status.status,
      progress: status.progress,
      data: status.data,
      updatedAt: status.updatedAt
    });

  } catch (error) {
    console.error('Video status error:', error);
    res.status(500).json({ error: 'Failed to get video status' });
  }
});

// Download video
app.get('/api/video/videos/:videoId/download', authenticateToken, (req, res) => {
  try {
    const { videoId } = req.params;
    const status = videoGenerationService.getGenerationStatus(videoId);

    if (!status || status.status !== 'completed' || !status.data?.filePath) {
      return res.status(404).json({ error: 'Video not found or not completed' });
    }

    res.download(status.data.filePath, `${videoId}.mp4`);

  } catch (error) {
    console.error('Video download error:', error);
    res.status(500).json({ error: 'Failed to download video' });
  }
});

// Stream video
app.get('/api/video/videos/:videoId/stream', authenticateToken, (req, res) => {
  try {
    const { videoId } = req.params;
    const status = videoGenerationService.getGenerationStatus(videoId);

    if (!status || status.status !== 'completed' || !status.data?.filePath) {
      return res.status(404).json({ error: 'Video not found or not completed' });
    }

    const videoPath = status.data.filePath;
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Support for video streaming with range requests
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      });
      
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      });
      
      fs.createReadStream(videoPath).pipe(res);
    }

  } catch (error) {
    console.error('Video streaming error:', error);
    res.status(500).json({ error: 'Failed to stream video' });
  }
});

// Get video generation history
app.get('/api/video/history', authenticateToken, (req, res) => {
  try {
    const { userId } = req.user;
    const { limit = 50 } = req.query;
    
    const history = videoGenerationService.getGenerationHistory(userId, parseInt(limit));
    
    res.json({
      success: true,
      videos: history
    });

  } catch (error) {
    console.error('Video history error:', error);
    res.status(500).json({ error: 'Failed to get video history' });
  }
});

// Delete video
app.delete('/api/video/videos/:videoId', authenticateToken, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { userId } = req.user;
    
    // Check if user owns the video (in production, would verify ownership)
    const result = await videoGenerationService.deleteVideo(videoId);
    
    res.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    console.error('Video deletion error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

// Get video analytics
app.get('/api/video/analytics', authenticateToken, (req, res) => {
  try {
    const analytics = videoGenerationService.getVideoAnalytics();
    
    res.json({
      success: true,
      analytics: analytics
    });

  } catch (error) {
    console.error('Video analytics error:', error);
    res.status(500).json({ error: 'Failed to get video analytics' });
  }
});
// Get 3D generation status
app.get('/api/3d/status/:modelId', authenticateToken, (req, res) => {
  try {
    const { modelId } = req.params;
    const status = threeDService.getGenerationStatus(modelId);

    if (!status) {
      return res.status(404).json({ error: 'Model generation not found' });
    }

    res.json({
      success: true,
      status: status.status,
      progress: status.progress,
      data: status.data,
      updatedAt: status.updatedAt
    });

  } catch (error) {
    console.error('3D Status error:', error);
    res.status(500).json({ error: 'Failed to get generation status' });
  }
});

// Download 3D model
app.get('/api/3d/models/:modelId/download', authenticateToken, (req, res) => {
  try {
    const { modelId } = req.params;
    const status = threeDService.getGenerationStatus(modelId);

    if (!status || status.status !== 'completed' || !status.data?.filePath) {
      return res.status(404).json({ error: 'Model not found or not completed' });
    }

    res.download(status.data.filePath, `${modelId}.glb`);

  } catch (error) {
    console.error('3D Download error:', error);
    res.status(500).json({ error: 'Failed to download model' });
  }
});

// Get 3D asset library
app.get('/api/3d/assets', authenticateToken, (req, res) => {
  try {
    const assets = threeDService.getAssetLibrary();
    
    res.json({
      success: true,
      assets: assets
    });

  } catch (error) {
    console.error('3D Assets error:', error);
    res.status(500).json({ error: 'Failed to get asset library' });
  }
});

// Enhance 3D description endpoint
app.post('/api/ai/enhance-3d', authenticateToken, async (req, res) => {
  try {
    const { description } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const enhanced = await aiService.enhance3DDescription(description.trim());

    res.json({
      success: true,
      enhanced: enhanced
    });

  } catch (error) {
    console.error('3D Enhancement error:', error);
    res.status(500).json({ error: 'Failed to enhance description' });
  }
});

// AI Content Generation endpoint
app.post('/api/ai/generate-content', authenticateToken, async (req, res) => {
  try {
    const { prompt, type = 'description' } = req.body;
    const { userId, username } = req.user;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Content prompt is required' });
    }

    const content = await aiService.generateCreativeContent(prompt.trim(), type);

    res.json({
      success: true,
      content: content,
      type: type,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI Content Generation error:', error);
    res.status(500).json({ error: 'Failed to generate content' });
  }
});

// Conversation summary endpoint
app.post('/api/ai/summarize', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.body;
    
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }

    const conversation = conversations.get(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const summary = await aiService.generateConversationSummary(conversation.messages);

    res.json({
      success: true,
      summary: summary,
      conversationId: conversationId
    });

  } catch (error) {
    console.error('Summary Generation error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// Sentiment analysis endpoint
app.post('/api/ai/sentiment', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const analysis = await aiService.analyzeSentiment(message.trim());

    res.json({
      success: true,
      analysis: analysis
    });

  } catch (error) {
    console.error('Sentiment Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze sentiment' });
  }
});

// Avatar routes
const avatarRoutes = require('./routes/avatars');
app.use('/api/avatar', avatarRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Cleanup services periodically
  setInterval(() => {
    aiService.cleanupContexts();
    threeDService.cleanup();
  }, 30 * 60 * 1000); // Every 30 minutes

  // Join conversation room
  socket.on('join_conversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`User ${socket.id} joined conversation ${conversationId}`);
  });

  // Leave conversation room
  socket.on('leave_conversation', (conversationId) => {
    socket.leave(conversationId);
    console.log(`User ${socket.id} left conversation ${conversationId}`);
  });

  // Join video room
  socket.on('join_video_room', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user_joined_video', {
      roomId,
      socketId: socket.id
    });
    console.log(`User ${socket.id} joined video room ${roomId}`);
  });

  // Leave video room
  socket.on('leave_video_room', (roomId) => {
    socket.leave(roomId);
    socket.to(roomId).emit('user_left_video', {
      roomId,
      socketId: socket.id
    });
    console.log(`User ${socket.id} left video room ${roomId}`);
  });

  // WebRTC signaling
  socket.on('offer', (data) => {
    socket.to(data.roomId).emit('offer', {
      offer: data.offer,
      from: socket.id
    });
  });

  socket.on('answer', (data) => {
    socket.to(data.roomId).emit('answer', {
      answer: data.answer,
      from: socket.id
    });
  });

  // AI-enhanced chat message handling
  socket.on('ai_chat_message', async (data) => {
    try {
      const { conversationId, message, username, userId } = data;
      
      // Save user message
      const userMessage = {
        id: uuidv4(),
        userId,
        username,
        message,
        timestamp: new Date().toISOString(),
        type: 'text'
      };

      // Get user profile for AI context
      const user = users.get(username);
      
      // Generate AI response
      const aiResponse = await aiService.generateResponse(
        message,
        conversationId,
        user ? { preferences: user.preferences } : {}
      );

      // Create AI message
      const aiMessage = {
        id: aiResponse.id,
        userId: 'ai-assistant',
        username: 'AI Assistant',
        message: aiResponse.content,
        timestamp: aiResponse.timestamp,
        type: 'ai_response',
        metadata: aiResponse.metadata
      };

      // Save to conversation
      const conversation = conversations.get(conversationId);
      if (conversation) {
        conversation.messages.push(userMessage, aiMessage);
      }

      // Emit both messages to all users in the conversation
      io.to(conversationId).emit('new_message', {
        conversationId,
        message: userMessage
      });

      io.to(conversationId).emit('ai_response', {
        conversationId,
        message: aiMessage
      });

    } catch (error) {
      console.error('AI Chat Socket Error:', error);
      socket.emit('error', { message: 'Failed to process AI chat message' });
    }
  });

  // 3D Model generation request via WebSocket
  socket.on('generate_3d_model', async (data) => {
    try {
      const { description, options, conversationId } = data;
      const { username, userId } = socket.user || { username: 'Unknown', userId: 'unknown' };

      if (!description || !description.trim()) {
        socket.emit('3d_generation_error', { error: 'Description is required' });
        return;
      }

      // Start 3D generation
      const generationResult = await threeDService.generate3DModel(
        description.trim(),
        {
          quality: options?.quality || 'medium',
          style: options?.style || 'realistic',
          format: options?.format || 'glb',
          complexity: options?.complexity || 'medium'
        }
      );

      // Send immediate response
      socket.emit('3d_generation_started', {
        modelId: generationResult.modelId,
        status: generationResult.status,
        estimatedTime: generationResult.estimatedTime
      });

      // Set up progress polling for this model
      const checkProgress = setInterval(async () => {
        const status = threeDService.getGenerationStatus(generationResult.modelId);
        
        if (status) {
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(checkProgress);
            
            if (status.status === 'completed') {
              socket.emit('3d_generation_completed', {
                modelId: generationResult.modelId,
                data: status.data
              });

              // Also emit to conversation if provided
              if (conversationId) {
                io.to(conversationId).emit('3d_model_shared', {
                  modelId: generationResult.modelId,
                  description: description.trim(),
                  data: status.data,
                  generatedBy: username
                });
              }
            } else {
              socket.emit('3d_generation_failed', {
                modelId: generationResult.modelId,
                error: status.data?.error || 'Generation failed'
              });
            }
          } else {
            // Send progress update
            socket.emit('3d_generation_progress', {
              modelId: generationResult.modelId,
              progress: status.progress,
              status: status.status
            });
          }
        }
      }, 2000); // Check every 2 seconds

    } catch (error) {
      console.error('3D Generation Socket Error:', error);
      socket.emit('3d_generation_error', { error: 'Failed to start 3D generation' });
    }
  });

  // 3D Model download request
  socket.on('download_3d_model', (data) => {
    try {
      const { modelId } = data;
      const status = threeDService.getGenerationStatus(modelId);

      if (!status || status.status !== 'completed' || !status.data?.downloadUrl) {
        socket.emit('3d_download_error', { error: 'Model not found or not completed' });
        return;
      }

      socket.emit('3d_download_ready', {
        modelId: modelId,
        downloadUrl: status.data.downloadUrl
      });

    } catch (error) {
      console.error('3D Download Socket Error:', error);
      socket.emit('3d_download_error', { error: 'Failed to prepare download' });
    }
  });

  // AI content generation request
  socket.on('generate_ai_content', async (data) => {
    try {
      const { prompt, type = 'description', conversationId } = data;
      
      if (!prompt || !prompt.trim()) {
        socket.emit('ai_content_error', { error: 'Content prompt is required' });
        return;
      }

      socket.emit('ai_content_generating', { type });

      const content = await aiService.generateCreativeContent(prompt.trim(), type);

      socket.emit('ai_content_generated', {
        content: content,
        type: type,
        timestamp: new Date().toISOString()
      });

      // Also share to conversation if provided
      if (conversationId) {
        const contentMessage = {
          id: uuidv4(),
          userId: 'ai-assistant',
          username: 'AI Assistant',
          message: content,
          timestamp: new Date().toISOString(),
          type: 'ai_content',
          metadata: { contentType: type, prompt: prompt.trim() }
        };

        const conversation = conversations.get(conversationId);
        if (conversation) {
          conversation.messages.push(contentMessage);
        }

        io.to(conversationId).emit('new_message', {
          conversationId,
          message: contentMessage
        });
      }

    } catch (error) {
      console.error('AI Content Generation Socket Error:', error);
      socket.emit('ai_content_error', { error: 'Failed to generate content' });
    }
  });

  // Enhanced typing indicators with AI context
  socket.on('ai_typing_start', (data) => {
    socket.to(data.conversationId).emit('user_ai_typing', {
      username: data.username,
      isTyping: true,
      context: data.context || 'general'
    });
  });

  socket.on('ai_typing_stop', (data) => {
    socket.to(data.conversationId).emit('user_ai_typing', {
      username: data.username,
      isTyping: false,
      context: data.context || 'general'
    });
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.roomId).emit('ice-candidate', {
      candidate: data.candidate,
      from: socket.id
    });
  });

  // Chat message via socket
  socket.on('send_message', (data) => {
    const { conversationId, message, username, userId } = data;
    
    const chatMessage = {
      id: uuidv4(),
      userId,
      username,
      message,
      timestamp: new Date().toISOString(),
      type: 'text'
    };

    // Save to conversation
    const conversation = conversations.get(conversationId);
    if (conversation) {
      conversation.messages.push(chatMessage);
    }

    // Emit to all users in the conversation
    io.to(conversationId).emit('new_message', {
      conversationId,
      message: chatMessage
    });
  });

  // Typing indicators
  socket.on('typing_start', (data) => {
    socket.to(data.conversationId).emit('user_typing', {
      username: data.username,
      isTyping: true
    });
  });

  socket.on('typing_stop', (data) => {
    socket.to(data.conversationId).emit('user_typing', {
      username: data.username,
      isTyping: false
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    // Update user online status
    // Note: In a real application, you'd track socket-to-user mapping
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Client URL: ${process.env.CLIENT_URL || "http://localhost:3000"}`);
  console.log(`🔐 JWT Secret: ${process.env.JWT_SECRET ? "Set" : "Using fallback"}`);
});

module.exports = { app, server, io };