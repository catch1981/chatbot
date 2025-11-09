# Realtime Chatbot App

A comprehensive real-time chatbot application with AI, 3D model generation, and video generation capabilities.

## Features

- **Real-time Chat**: Socket.IO powered instant messaging
- **AI Integration**: Advanced AI responses and content generation
- **3D Model Generation**: Generate 3D models from text descriptions
- **Video Generation**: Create videos from text, images, or 3D models
- **Authentication**: Secure user registration and login
- **Video Calls**: WebRTC video calling functionality
- **PWA Support**: Progressive Web App capabilities

## Tech Stack

- **Backend**: Node.js, Express.js, Socket.IO
- **Frontend**: React.js, Context API
- **Real-time**: Socket.IO for WebSocket connections
- **AI Services**: Multiple AI service integrations
- **3D Services**: 3D model generation and processing
- **Video Services**: Video generation from various sources

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/catch1981/chatbot.git
   cd chatbot
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd client && npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Configure your environment variables
   ```

4. **Start the application**
   ```bash
   # Terminal 1: Start the server
   npm run server
   
   # Terminal 2: Start the client
   npm run client
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Project Structure

```
chatbot/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── context/       # Context providers
│   │   └── services/      # Frontend services
│   └── public/           # Static assets
├── server/               # Node.js backend
│   ├── services/         # Business logic services
│   ├── routes/          # API routes
│   └── index.js         # Main server file
├── docker-compose.yml   # Docker configuration
└── README.md           # This file
```

## Key Services

- **aiService.js**: AI chat and content generation
- **threeDService.js**: 3D model generation and processing
- **videoGenerationService.js**: Video creation from multiple sources
- **securityService.js**: Authentication and security
- **collaborationService.js**: Real-time collaboration features

## Documentation

- [Architecture Overview](ARCHITECTURE.md)
- [Implementation Roadmap](IMPLEMENTATION_ROADMAP.md)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)
- [Testing Guide](TESTING_GUIDE.md)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.

---

**Repository URL**: https://github.com/catch1981/chatbot