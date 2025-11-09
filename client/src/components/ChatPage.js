import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import { 
  FaPaperPlane, 
  FaVideo, 
  FaUserCircle, 
  FaComments,
  FaCircle,
  FaSignOutAlt,
  FaCog
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import axios from 'axios';

const ChatContainer = styled.div`
  display: flex;
  height: calc(100vh - 60px);
  background: rgba(255, 255, 255, 0.05);
`;

const Sidebar = styled.div`
  width: 300px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
`;

const SidebarHeader = styled.div`
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  
  h3 {
    color: white;
    margin: 0;
    font-size: 1.2rem;
  }
`;

const ConversationList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 10px 0;
`;

const ConversationItem = styled(motion.div)`
  padding: 15px 20px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  &.active {
    background: rgba(255, 107, 107, 0.2);
  }
`;

const ConversationTitle = styled.div`
  color: white;
  font-weight: 600;
  margin-bottom: 5px;
`;

const LastMessage = styled.div`
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ChatArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const ChatHeader = styled.div`
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const ChatTitle = styled.div`
  color: white;
  font-weight: 600;
  font-size: 1.1rem;
`;

const ChatActions = styled.div`
  display: flex;
  gap: 10px;
`;

const ActionButton = styled(motion.button)`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  padding: 10px 15px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const MessagesContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const Message = styled(motion.div)`
  display: flex;
  ${props => props.isOwn ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}
  
  .message-content {
    max-width: 70%;
    padding: 12px 16px;
    border-radius: 18px;
    ${props => props.isOwn 
      ? 'background: linear-gradient(45deg, #ff6b6b, #ee5a24); color: white;' 
      : 'background: rgba(255, 255, 255, 0.2); color: white;'}
    
    .message-sender {
      font-size: 0.8rem;
      opacity: 0.8;
      margin-bottom: 4px;
    }
    
    .message-text {
      word-wrap: break-word;
    }
    
    .message-time {
      font-size: 0.7rem;
      opacity: 0.6;
      margin-top: 4px;
      text-align: right;
    }
  }
`;

const TypingIndicator = styled(motion.div)`
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
  font-size: 0.9rem;
  padding: 10px 20px;
`;

const MessageInputContainer = styled.div`
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
`;

const InputForm = styled.form`
  display: flex;
  gap: 10px;
  align-items: center;
`;

const MessageInput = styled.input`
  flex: 1;
  padding: 12px 20px;
  border: none;
  border-radius: 25px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  outline: none;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.6);
  }
  
  &:focus {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const SendButton = styled(motion.button)`
  background: linear-gradient(45deg, #ff6b6b, #ee5a24);
  border: none;
  color: white;
  padding: 12px 20px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 50px;
  height: 50px;
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const NewChatButton = styled(motion.button)`
  background: linear-gradient(45deg, #4CAF50, #45a049);
  border: none;
  color: white;
  padding: 12px 20px;
  border-radius: 8px;
  cursor: pointer;
  margin: 10px 20px;
  font-weight: 600;
  
  &:hover {
    transform: translateY(-1px);
  }
`;

const ChatPage = () => {
  const { user, logout } = useAuth();
  const { socket, isConnected } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (socket && isConnected) {
      // Listen for new messages
      socket.on('new_message', (data) => {
        setMessages(prev => [...prev, data.message]);
        updateConversationLastMessage(data.conversationId, data.message);
      });

      // Listen for typing indicators
      socket.on('user_typing', (data) => {
        if (data.username !== user.username) {
          if (data.isTyping) {
            setTypingUsers(prev => [...prev.filter(u => u !== data.username), data.username]);
          } else {
            setTypingUsers(prev => prev.filter(u => u !== data.username));
          }
        }
      });

      return () => {
        socket.off('new_message');
        socket.off('user_typing');
      };
    }
  }, [socket, isConnected, user.username]);

  useEffect(() => {
    // Load conversations when component mounts
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      // In a real app, you'd have an endpoint to get all conversations
      // For now, we'll create a default conversation
      const defaultConversation = {
        id: 'default',
        title: 'General Chat',
        messages: [],
        createdAt: new Date().toISOString()
      };
      setConversations([defaultConversation]);
      setCurrentConversation(defaultConversation);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      toast.error('Failed to load conversations');
    }
  };

  const updateConversationLastMessage = (conversationId, message) => {
    setConversations(prev => prev.map(conv => 
      conv.id === conversationId 
        ? { ...conv, lastMessage: message }
        : conv
    ));
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !isConnected) return;

    const messageData = {
      conversationId: currentConversation.id,
      message: newMessage.trim(),
      username: user.username,
      userId: user.id
    };

    // Send via socket for real-time delivery
    socket.emit('send_message', messageData);

    // Also send via API for persistence
    try {
      await axios.post('/api/chat/send', {
        message: newMessage.trim(),
        conversationId: currentConversation.id
      });
    } catch (error) {
      console.error('Failed to save message:', error);
    }

    setNewMessage('');
    stopTyping();
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing_start', {
        conversationId: currentConversation.id,
        username: user.username
      });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  };

  const stopTyping = () => {
    if (isTyping) {
      setIsTyping(false);
      socket.emit('typing_stop', {
        conversationId: currentConversation.id,
        username: user.username
      });
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const createNewChat = () => {
    const newConv = {
      id: Date.now().toString(),
      title: `Chat ${conversations.length + 1}`,
      messages: [],
      createdAt: new Date().toISOString()
    };
    setConversations(prev => [...prev, newConv]);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <ChatContainer>
      <Sidebar>
        <SidebarHeader>
          <h3>Chats</h3>
        </SidebarHeader>
        
        <NewChatButton
          onClick={createNewChat}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          + New Chat
        </NewChatButton>

        <ConversationList>
          {conversations.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              className={currentConversation?.id === conversation.id ? 'active' : ''}
              onClick={() => setCurrentConversation(conversation)}
              whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
            >
              <ConversationTitle>{conversation.title}</ConversationTitle>
              {conversation.lastMessage && (
                <LastMessage>
                  {conversation.lastMessage.username}: {conversation.lastMessage.message}
                </LastMessage>
              )}
            </ConversationItem>
          ))}
        </ConversationList>
      </Sidebar>

      <ChatArea>
        <ChatHeader>
          <ChatTitle>{currentConversation?.title || 'Select a conversation'}</ChatTitle>
          <ChatActions>
            <ActionButton
              onClick={() => window.location.href = '/video'}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FaVideo />
              Video
            </ActionButton>
            <ActionButton
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FaCog />
            </ActionButton>
          </ChatActions>
        </ChatHeader>

        <MessagesContainer>
          <AnimatePresence>
            {messages.map((message) => (
              <Message
                key={message.id}
                isOwn={message.username === user.username}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="message-content">
                  {message.username !== user.username && (
                    <div className="message-sender">{message.username}</div>
                  )}
                  <div className="message-text">{message.message}</div>
                  <div className="message-time">
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </Message>
            ))}
          </AnimatePresence>

          <AnimatePresence>
            {typingUsers.length > 0 && (
              <TypingIndicator
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </TypingIndicator>
            )}
          </AnimatePresence>
          
          <div ref={messagesEndRef} />
        </MessagesContainer>

        <MessageInputContainer>
          <InputForm onSubmit={sendMessage}>
            <MessageInput
              type="text"
              placeholder="Type a message..."
              value={newMessage}
              onChange={handleInputChange}
              onBlur={stopTyping}
            />
            <SendButton
              type="submit"
              disabled={!newMessage.trim() || !isConnected}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <FaPaperPlane />
            </SendButton>
          </InputForm>
        </MessageInputContainer>
      </ChatArea>
    </ChatContainer>
  );
};

export default ChatPage;