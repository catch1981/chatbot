# 🧪 Comprehensive Testing Guide
## Real-time Chatbot with AI & 3D Generation

This guide will help you set up, run, and test all features of the comprehensive real-time chatbot platform.

---

## 📋 Quick Start Testing

### 1. **Prerequisites Setup**

```bash
# Install Node.js 18+
node --version  # Should be 18.0.0 or higher

# Install MongoDB (optional - will use in-memory storage for testing)
# Download from: https://www.mongodb.com/try/download/community

# Install Redis (optional - will use in-memory caching for testing)
# Download from: https://redis.io/download

# Clone or access the project directory
cd realtime-chatbot-app
```

### 2. **Environment Configuration**

```bash
# Copy environment template
cp .env.example .env

# Edit the environment file with your API keys
nano .env
```

**Essential Environment Variables for Testing:**
```env
# Server Configuration
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000

# Security (Required for production)
JWT_SECRET=your-super-secure-jwt-secret-key-for-testing
ENCRYPTION_KEY=your-32-byte-encryption-key-here

# AI Services (Required for full functionality)
OPENAI_API_KEY=your-openai-api-key
STABILITY_API_KEY=your-stability-ai-key (optional)
REPLICATE_API_TOKEN=your-replicate-token (optional)

# Database (Optional - will use in-memory if not set)
MONGODB_URI=mongodb://localhost:27017/test_chatbot
REDIS_URL=redis://localhost:6379

# Testing Configuration
TEST_MODE=true
SKIP_SSL=true
MOCK_AI_RESPONSES=true
MOCK_3D_GENERATION=true
```

### 3. **Install Dependencies**

```bash
# Install server dependencies
npm install

# Install client dependencies (if you want to test the frontend)
cd client && npm install && cd ..
```

---

## 🚀 Running the Application

### **Option 1: Full System Test**
```bash
# Start the server
npm run dev

# In a new terminal, start the client (optional)
cd client && npm start
```

### **Option 2: Server Only (API Testing)**
```bash
# Start only the server for API testing
npm start
```

### **Expected Output:**
```
🚀 Server running on port 5000
📱 Client URL: http://localhost:3000
🔐 JWT Secret: Set
🤖 AI Service: Initialized
🎨 3D Service: Initialized
🔒 Security Service: Initialized
📊 Analytics Service: Initialized
🏢 Enterprise Service: Initialized
```

---

## 🧪 Core Feature Testing

### **1. Health Check Test**
```bash
# Test basic server health
curl http://localhost:5000/api/health

# Expected response:
{
  "status": "OK",
  "timestamp": "2025-11-09T18:58:35.000Z",
  "uptime": 123.456,
  "services": {
    "ai": "healthy",
    "3d": "healthy", 
    "security": "healthy",
    "analytics": "healthy"
  }
}
```

### **2. User Registration & Authentication Test**
```bash
# Register a new user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com", 
    "password": "SecurePassword123!"
  }'

# Login with the new user
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "SecurePassword123!"
  }'
```

### **3. Basic Chat Test**
```bash
# Extract the token from login response and set it
TOKEN="your-jwt-token-here"

# Send a test message
curl -X POST http://localhost:5000/api/chat/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello! This is a test message."
  }'
```

### **4. AI Response Test**
```bash
# Test AI-powered chat
curl -X POST http://localhost:5000/api/ai/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Can you help me create a 3D model of a chair?"
  }'
```

### **5. 3D Model Generation Test**
```bash
# Test 3D model generation
curl -X POST http://localhost:5000/api/3d/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "a modern office chair with wheels",
    "options": {
      "quality": "medium",
      "style": "realistic",
      "complexity": "medium"
    }
  }'

# Check generation status
curl http://localhost:5000/api/3d/status/YOUR_MODEL_ID \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔌 WebSocket Testing

### **1. Real-time Chat Test**
```bash
# Install a WebSocket testing tool
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:5000

# Test message sending
> {"type": "send_message", "conversationId": "test-conv", "message": "WebSocket test message", "username": "testuser"}

# Test AI chat
> {"type": "ai_chat_message", "conversationId": "test-conv", "message": "Generate a 3D cube for me", "username": "testuser"}
```

### **2. Real-time 3D Generation**
```bash
# Test 3D generation via WebSocket
> {"type": "generate_3d_model", "description": "a simple cube", "options": {"quality": "low"}}

# You should receive progress updates:
< {"type": "3d_generation_started", "modelId": "..."}
< {"type": "3d_generation_progress", "progress": 50, "status": "processing"}
< {"type": "3d_generation_completed", "modelId": "...", "data": {...}}
```

---

## 🧠 AI Service Testing

### **1. Content Generation Test**
```bash
# Test creative content generation
curl -X POST http://localhost:5000/api/ai/generate-content \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a short story about AI and 3D printing",
    "type": "story"
  }'
```

### **2. 3D Description Enhancement**
```bash
# Test AI enhancement of 3D descriptions
curl -X POST http://localhost:5000/api/ai/enhance-3d \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "a chair"
  }'
```

### **3. Sentiment Analysis**
```bash
# Test sentiment analysis
curl -X POST http://localhost:5000/api/ai/sentiment \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I love using this amazing AI platform!"
  }'
```

---

## 🎨 3D Service Testing

### **1. Asset Library Test**
```bash
# Get available 3D assets
curl http://localhost:5000/api/3d/assets \
  -H "Authorization: Bearer $TOKEN"
```

### **2. Model Download Test**
```bash
# Download a completed 3D model
curl -O http://localhost:5000/api/3d/models/YOUR_MODEL_ID/download \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔒 Security Testing

### **1. Authentication Test**
```bash
# Test with invalid token
curl -H "Authorization: Bearer invalid-token" \
  http://localhost:5000/api/user/profile

# Should return 401/403 error
```

### **2. Rate Limiting Test**
```bash
# Test rate limiting
for i in {1..110}; do
  curl http://localhost:5000/api/health
done

# Should start returning 429 (Too Many Requests) after 100 requests
```

### **3. Content Moderation Test**
```bash
# Test content moderation (if you have moderation service)
curl -X POST http://localhost:5000/api/moderation/check \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "image",
    "data": "base64-image-data-here"
  }'
```

---

## 📊 Analytics Testing

### **1. Real-time Dashboard Test**
```bash
# Get real-time analytics
curl http://localhost:5000/api/analytics/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

### **2. Performance Metrics Test**
```bash
# Get performance metrics
curl http://localhost:5000/api/analytics/performance \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🏢 Enterprise Features Testing

### **1. Organization Creation Test**
```bash
# Create an organization
curl -X POST http://localhost:5000/api/enterprise/organization \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Organization",
    "plan": "business"
  }'
```

### **2. White-label Configuration Test**
```bash
# Test white-label configuration
curl -X POST http://localhost:5000/api/enterprise/whitelabel \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Custom Platform",
    "colors": {
      "primary": "#FF6B6B",
      "secondary": "#4ECDC4"
    }
  }'
```

---

## 🧪 Automated Testing

### **1. API Integration Tests**
```bash
# Run API tests (if test files are created)
npm test

# Or run specific test suites
npm run test:api
npm run test:websocket
npm run test:ai
npm run test:3d
```

### **2. Load Testing**
```bash
# Install artillery for load testing
npm install -g artillery

# Create load test config
cat > load-test.yml << EOF
config:
  target: 'http://localhost:5000'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: "Health Check"
    requests:
      - get:
          url: "/api/health"
  - name: "User Registration"
    requests:
      - post:
          url: "/api/auth/register"
          json:
            username: "user{{ $randomString() }}"
            email: "test{{ $randomNumber() }}@example.com"
            password: "TestPassword123!"
EOF

# Run load test
artillery run load-test.yml
```

---

## 🖥️ Frontend Testing (Optional)

### **1. Client Setup**
```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Start the React development server
npm start
```

### **2. Browser Testing**
- Open `http://localhost:3000` in your browser
- Test user registration and login
- Send messages and receive AI responses
- Generate 3D models through the UI
- Test real-time collaboration features

---

## 🔍 Troubleshooting

### **Common Issues & Solutions**

#### **1. Port Already in Use**
```bash
# Kill process using port 5000
lsof -ti:5000 | xargs kill -9

# Or use a different port
PORT=5001 npm start
```

#### **2. MongoDB Connection Issues**
```bash
# If MongoDB is not running, the app will use in-memory storage
# To start MongoDB:
sudo systemctl start mongod

# Or use Docker:
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

#### **3. Missing API Keys**
```bash
# If OpenAI API key is missing, AI features will use mock responses
# Set your OpenAI API key in .env file:
OPENAI_API_KEY=sk-your-key-here

# Test with mock mode:
MOCK_AI_RESPONSES=true npm start
```

#### **4. WebSocket Connection Failed**
```bash
# Check if server is running
curl http://localhost:5000/api/health

# Test WebSocket connection manually:
wscat -c ws://localhost:5000
```

### **Debug Mode Testing**
```bash
# Run with debug logging
DEBUG=* npm start

# Test specific services
DEBUG=aiService:* npm start
DEBUG=3dService:* npm start
```

---

## 📈 Performance Testing

### **1. Response Time Testing**
```bash
# Time individual API calls
time curl http://localhost:5000/api/health

# Test with multiple concurrent requests
for i in {1..50}; do
  (curl -s http://localhost:5000/api/health &)
done
```

### **2. Memory Usage Testing**
```bash
# Monitor memory usage
top -p $(pgrep -f "node.*index.js")

# Check process memory
ps aux | grep node
```

---

## ✅ Testing Checklist

### **Core Functionality**
- [ ] Health check endpoint responds
- [ ] User registration and login works
- [ ] Real-time chat via WebSocket
- [ ] AI response generation
- [ ] 3D model generation and download
- [ ] File upload and serving
- [ ] Authentication middleware

### **Advanced Features**
- [ ] Real-time collaborative 3D editing
- [ ] Multi-modal AI (voice-to-3D, image-to-3D)
- [ ] Content moderation and safety
- [ ] Analytics and monitoring
- [ ] Enterprise features
- [ ] White-label customization

### **Security & Performance**
- [ ] Rate limiting works
- [ ] Authentication required for protected routes
- [ ] Input validation and sanitization
- [ ] Error handling and logging
- [ ] Performance under load
- [ ] Memory usage optimization

---

## 🎯 Quick Test Commands

```bash
# Complete quick test sequence
#!/bin/bash
echo "🧪 Testing Real-time Chatbot Platform"

# 1. Health check
echo "1. Testing health check..."
curl -s http://localhost:5000/api/health | jq .

# 2. User registration
echo "2. Testing user registration..."
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@test.com","password":"Test123!"}')
echo $TOKEN_RESPONSE | jq .

# Extract token (manual step needed)
echo "3. Set TOKEN variable with the token from the response above"
echo "4. Then run: curl -H \"Authorization: Bearer \$TOKEN\" http://localhost:5000/api/user/profile"

echo "✅ Quick test sequence complete!"
```

---

## 📞 Getting Help

If you encounter issues during testing:

1. **Check the logs** for detailed error messages
2. **Verify environment variables** are properly set
3. **Ensure all services** are running (MongoDB, Redis if configured)
4. **Test with mock mode** if API keys are not available
5. **Check network connectivity** and port availability

The system is designed to work with minimal setup, using in-memory storage and mock AI responses if external services are not configured. This allows for immediate testing and development!

---

**Happy Testing! 🚀**