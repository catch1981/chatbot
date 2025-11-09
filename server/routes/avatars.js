const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/avatars');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

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

// Upload avatar image
router.post('/upload-avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const userId = req.user.userId;

    // In a real application, you would save this to a database
    // For now, we'll return the file path
    res.json({
      success: true,
      avatarUrl: avatarUrl,
      filename: req.file.filename,
      message: 'Avatar uploaded successfully'
    });

  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Get user avatars
router.get('/avatars', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // In a real application, you would fetch from database
    // For now, return empty array
    res.json({
      avatars: []
    });

  } catch (error) {
    console.error('Get avatars error:', error);
    res.status(500).json({ error: 'Failed to get avatars' });
  }
});

// Delete avatar
router.delete('/avatar/:filename', authenticateToken, async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../uploads/avatars', filename);
    
    // Check if file exists and delete it
    await fs.unlink(filePath);
    
    res.json({
      success: true,
      message: 'Avatar deleted successfully'
    });

  } catch (error) {
    console.error('Delete avatar error:', error);
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'Avatar not found' });
    }
    res.status(500).json({ error: 'Failed to delete avatar' });
  }
});

// Process face replacement for video
router.post('/process-face-replacement', authenticateToken, upload.single('faceImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No face image provided' });
    }

    // In a real implementation, this would:
    // 1. Use AI/ML models to process the face
    // 2. Generate a face model for replacement
    // 3. Return processing status and model data
    
    const processingId = uuidv4();
    const faceModelUrl = `/uploads/face-models/${processingId}.json`;
    
    // Simulate processing time
    setTimeout(() => {
      // In real implementation, trigger background processing
      console.log(`Processing face model for user ${req.user.userId} with image ${req.file.filename}`);
    }, 1000);

    res.json({
      success: true,
      processingId: processingId,
      faceModelUrl: faceModelUrl,
      status: 'processing',
      message: 'Face model creation started'
    });

  } catch (error) {
    console.error('Face replacement processing error:', error);
    res.status(500).json({ error: 'Failed to process face replacement' });
  }
});

// Get processing status
router.get('/processing-status/:processingId', authenticateToken, async (req, res) => {
  try {
    const { processingId } = req.params;
    
    // In a real implementation, check processing status from queue/database
    const status = 'completed'; // Simulated status
    
    res.json({
      processingId: processingId,
      status: status,
      faceModelUrl: `/uploads/face-models/${processingId}.json`,
      message: status === 'completed' ? 'Face model ready' : 'Still processing...'
    });

  } catch (error) {
    console.error('Get processing status error:', error);
    res.status(500).json({ error: 'Failed to get processing status' });
  }
});

module.exports = router;