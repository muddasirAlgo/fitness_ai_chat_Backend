const jwt = require('jsonwebtoken');
const User = require('../models/User.js');
const Chat = require('../models/Chat.js');
const Profile = require('../models/Profile.js');
const claudeService = require('../utils/claudeService.js');

class ChatSocket {
  constructor(io) {
    this.io = io;
    this.userSockets = new Map(); // userId -> socketId
    this.socketUsers = new Map(); // socketId -> userId
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', async (socket) => {
      console.log('New socket connection:', socket.id);

      // Authenticate socket connection
      const authenticated = await this.authenticateSocket(socket);
      if (!authenticated) {
        socket.disconnect();
        return;
      }

      // Store user-socket mapping
      const userId = socket.userId;
      this.userSockets.set(userId, socket.id);
      this.socketUsers.set(socket.id, userId);

      console.log(`User ${userId} connected with socket ${socket.id}`);

      // Handle chat events
      this.handleChatEvents(socket);

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  async authenticateSocket(socket) {
    try {
      console.log('🔐 Starting socket authentication...');
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        console.log('❌ No authentication token provided');
        socket.emit('error', { message: 'Authentication token required' });
        return false;
      }

      console.log('🔑 Token found, verifying...');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ JWT verified, user ID:', decoded.id);
      
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        console.log('❌ User not found in database');
        socket.emit('error', { message: 'User not found' });
        return false;
      }

      // Check if token is still valid
      if (!user.isTokenValid(token)) {
        console.log('❌ Token is invalid or expired');
        socket.emit('error', { message: 'Token is invalid or expired' });
        return false;
      }

      // Get user profile for personalized responses
      const profile = await Profile.findOne({ user: user._id });
      console.log('👤 User profile found:', profile ? 'Yes' : 'No');

      socket.userId = user._id.toString();
      socket.user = user;
      socket.userProfile = profile;
      
      console.log('✅ Socket authentication successful for user:', user.email);
      return true;

    } catch (error) {
      console.error('❌ Socket authentication error:', error);
      socket.emit('error', { message: 'Authentication failed' });
      return false;
    }
  }

  handleChatEvents(socket) {
    // Join chat room
    socket.on('join_chat', async (data) => {
      try {
        console.log('🚪 Received join_chat event:', data);
        if (!data || !data.sessionId) {
          console.log('❌ Invalid join_chat data:', data);
          socket.emit('error', { message: 'Invalid session ID for joining chat' });
          return;
        }
        
        const { sessionId } = data;
        const userId = socket.userId;

        console.log('🔍 Verifying user access to chat:', sessionId);
        // Verify user has access to this chat
        const chat = await Chat.getChatSessionId(sessionId, userId);
        console.log('🔍 Chat lookup result:', chat);
        if (!chat) {
          console.log('❌ Chat not found or access denied for user:', userId);
          socket.emit('error', { message: 'Chat not found or access denied' });
          return;
        }

        console.log('✅ Chat access verified, joining room');
        socket.join(`chat_${sessionId}`);
        socket.currentChatSession = sessionId;

        // Send chat history
        const chatHistoryData = {
          sessionId,
          messages: chat.messages,
          title: chat.title
        };
        console.log('📤 Sending chat history:', chatHistoryData);
        socket.emit('chat_history', chatHistoryData);

        console.log(`✅ User ${userId} joined chat ${sessionId}`);

      } catch (error) {
        console.error('❌ Join chat error:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    // Send message
    socket.on('send_message', async (data) => {
      try {
        console.log('📨 Received send_message event:', data);
        if (!data) {
          console.log('❌ No data received for send_message');
          socket.emit('error', { message: 'No data provided for sending message' });
          return;
        }
        
        const { sessionId, message, messageType = 'text', imageUrl = null } = data;
        const userId = socket.userId;

        if (!message || message.trim() === '') {
          console.log('❌ Empty message received');
          socket.emit('error', { message: 'Message cannot be empty' });
          return;
        }

        console.log('🔍 Looking for existing chat session:', sessionId);
        // Get or create chat session
        let chat = await Chat.getChatSessionId(sessionId, userId);
        console.log('🔍 Chat lookup result:', chat ? `Found chat: ${chat.sessionId}` : 'No chat found');
        
        if (!chat) {
          console.log('🆕 Creating new chat session for user:', userId);
          // Create new chat session
          chat = await Chat.createChatSession(userId);
          console.log('✅ New chat created:', chat);
          
          // Generate title from first message
          const title = await claudeService.generateChatTitle(message);
          console.log('📝 Generated title:', title);
          chat.title = title;
          await chat.save();
          console.log('💾 Chat saved with title:', chat.title);

          // Update socket's current chat session
          socket.currentChatSession = chat.sessionId;
          socket.join(`chat_${chat.sessionId}`);
          console.log('👥 User joined chat room:', `chat_${chat.sessionId}`);
        } else {
          console.log('✅ Found existing chat session:', chat);
        }

        // Add user message to chat
        console.log('💬 Adding user message to chat');
        const addMessageResult = await chat.addMessage('user', message.trim(), messageType, imageUrl);
        console.log('💬 Add message result:', addMessageResult);

        // Emit user message to all users in the chat room
        const userMessageData = {
          sessionId: chat.sessionId,
          message: {
            role: 'user',
            content: message.trim(),
            messageType,
            imageUrl,
            timestamp: new Date()
          }
        };
        console.log('📤 Emitting user message:', userMessageData);
        this.io.to(`chat_${chat.sessionId}`).emit('message_received', userMessageData);

        // Send typing indicator
        console.log('⌨️ Starting typing indicator');
        this.io.to(`chat_${chat.sessionId}`).emit('typing_started', {
          sessionId: chat.sessionId,
          userId: 'assistant'
        });

        // Get Claude response with personalized context
        let claudeResponse;
        if (messageType === 'image' && imageUrl) {
          console.log('🖼️ Processing image message');
          claudeResponse = await claudeService.analyzeImage(imageUrl, message);
          console.log('🖼️ Image analysis response:', claudeResponse);
        } else {
          console.log('🔍 Validating fitness query');
          // Validate if message is fitness/nutrition related
          const isValidQuery = await claudeService.validateFitnessQuery(message);
          console.log('🔍 Fitness query validation result:', isValidQuery);
          
          if (!isValidQuery) {
            console.log('❌ Non-fitness query detected');
            claudeResponse = {
              success: true,
              content: "I'm a fitness and nutrition specialist. I can help you with workout plans, nutrition advice, exercise form, meal planning, and fitness goals. Please ask me about fitness or nutrition-related topics."
            };
            console.log('❌ Non-fitness response:', claudeResponse);
          } else {
            console.log('✅ Fitness query validated, getting personalized response');
            
            // Create personalized context with user profile data
            let userContext = '';
            if (socket.userProfile) {
              const profile = socket.userProfile;
              userContext = `User Profile:
- Name: ${profile.name}
- Age: ${profile.age || 'Not specified'}
- Location: ${profile.location || 'Not specified'}
- Purpose: ${profile.purposeOfJoining || 'Not specified'}
- BMI: ${profile.bmi || 'Not specified'}
- Current Calorie Intake: ${profile.currentCalorieIntake || 'Not specified'}
- Current Protein Intake: ${profile.currentProteinIntake || 'Not specified'}
- Current Fat Intake: ${profile.currentFatIntake || 'Not specified'}
- Fitness Goals: ${profile.fitnessGoals || 'Not specified'}`;
            }
            
            console.log('👤 User context created:', userContext ? 'Yes' : 'No');
            if (userContext) {
              console.log('👤 User context:', userContext);
            }
            
            // Use personalized message method with PERSONALIZED_SYSTEM_PROMPT
            if (userContext) {
              console.log('🎯 Using personalized message method');
              claudeResponse = await claudeService.sendPersonalizedMessage(userContext, message);
              console.log('🎯 Personalized response:', claudeResponse);
            } else {
              console.log('💬 Using regular text message method');
              const conversationHistory = chat.getConversationHistory();
              console.log('💬 Conversation history:', conversationHistory);
              claudeResponse = await claudeService.sendTextMessage(conversationHistory, message);
              console.log('💬 Regular response:', claudeResponse);
            }
          }
        }

        // Stop typing indicator
        console.log('⏹️ Stopping typing indicator');
        this.io.to(`chat_${chat.sessionId}`).emit('typing_stopped', {
          sessionId: chat.sessionId,
          userId: 'assistant'
        });

        if (claudeResponse.success) {
          console.log('✅ Claude response successful, length:', claudeResponse.content.length);
          console.log('✅ Claude response content:', claudeResponse.content);
          
          // Add assistant response to chat
          const assistantMessageResult = await chat.addMessage('assistant', claudeResponse.content);
          console.log('🤖 Assistant message added result:', assistantMessageResult);

          // Emit assistant response
          const assistantMessageData = {
            sessionId: chat.sessionId,
            message: {
              role: 'assistant',
              content: claudeResponse.content,
              messageType: 'text',
              timestamp: new Date()
            }
          };
          console.log('📤 Emitting assistant response:', assistantMessageData);
          this.io.to(`chat_${chat.sessionId}`).emit('message_received', assistantMessageData);

          // Update chat title if it's the first message
          if (chat.messages.length === 2) { // user message + assistant response
            console.log('📝 Updating chat title for first message');
            const newTitle = await claudeService.generateChatTitle(message);
            if (newTitle && newTitle !== 'New Chat') {
              chat.title = newTitle;
              await chat.save();
              
              this.io.to(`chat_${chat.sessionId}`).emit('chat_title_updated', {
                sessionId: chat.sessionId,
                title: newTitle
              });
              console.log('✅ Chat title updated:', newTitle);
            }
          }

        } else {
          console.error('❌ Claude API Error:', claudeResponse.error);
          console.error('❌ Claude API Error details:', claudeResponse);
          // Handle Claude API error
          const errorMessage = "I'm sorry, I'm having trouble processing your request right now. Please try again in a moment.";
          
          const errorMessageResult = await chat.addMessage('assistant', errorMessage);
          console.log('❌ Error message added result:', errorMessageResult);
          
          const errorResponseData = {
            sessionId: chat.sessionId,
            message: {
              role: 'assistant',
              content: errorMessage,
              messageType: 'text',
              timestamp: new Date()
            }
          };
          console.log('📤 Emitting error response:', errorResponseData);
          this.io.to(`chat_${chat.sessionId}`).emit('message_received', errorResponseData);
        }

      } catch (error) {
        console.error('❌ Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Leave chat room
    socket.on('leave_chat', (data) => {
      try {
        console.log('🚪 Received leave_chat event:', data);
        if (!data || !data.sessionId) {
          console.log('❌ Invalid leave_chat data:', data);
          socket.emit('error', { message: 'Invalid session ID for leaving chat' });
          return;
        }
        
        const { sessionId } = data;
        socket.leave(`chat_${sessionId}`);
        socket.currentChatSession = null;
        console.log(`✅ User ${socket.userId} left chat ${sessionId}`);
      } catch (error) {
        console.error('❌ Leave chat error:', error);
        socket.emit('error', { message: 'Failed to leave chat' });
      }
    });

    // Typing indicator
    socket.on('typing_started', (data) => {
      try {
        console.log('⌨️ Received typing_started event:', data);
        if (!data || !data.sessionId) {
          console.log('❌ Invalid typing_started data:', data);
          socket.emit('error', { message: 'Invalid session ID for typing indicator' });
          return;
        }
        
        const { sessionId } = data;
        socket.to(`chat_${sessionId}`).emit('typing_started', {
          sessionId,
          userId: socket.userId
        });
        console.log(`✅ Typing started for user ${socket.userId} in chat ${sessionId}`);
      } catch (error) {
        console.error('❌ Typing started error:', error);
        socket.emit('error', { message: 'Failed to start typing indicator' });
      }
    });

    socket.on('typing_stopped', (data) => {
      try {
        console.log('⏹️ Received typing_stopped event:', data);
        if (!data || !data.sessionId) {
          console.log('❌ Invalid typing_stopped data:', data);
          socket.emit('error', { message: 'Invalid session ID for typing indicator' });
          return;
        }
        
        const { sessionId } = data;
        socket.to(`chat_${sessionId}`).emit('typing_stopped', {
          sessionId,
          userId: socket.userId
        });
        console.log(`✅ Typing stopped for user ${socket.userId} in chat ${sessionId}`);
      } catch (error) {
        console.error('❌ Typing stopped error:', error);
        socket.emit('error', { message: 'Failed to stop typing indicator' });
      }
    });
  }

  handleDisconnect(socket) {
    const userId = socket.userId;
    const socketId = socket.id;

    // Remove from mappings
    this.userSockets.delete(userId);
    this.socketUsers.delete(socketId);

    console.log(`User ${userId} disconnected from socket ${socketId}`);
  }

  // Method to send message to specific user
  sendToUser(userId, event, data) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }

  // Method to send message to all users in a chat room
  sendToChat(sessionId, event, data) {
    this.io.to(`chat_${sessionId}`).emit(event, data);
  }
}

module.exports = ChatSocket; 