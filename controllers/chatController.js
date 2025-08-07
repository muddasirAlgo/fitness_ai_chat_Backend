const Chat = require('../models/Chat.js');
const Profile = require('../models/Profile.js');
const HealthMetrics = require('../models/HealthMetrics.js');
const claudeService = require('../utils/claudeService.js');

// Get user's chat history
async function getUserChats(req, res) {
  try {
    const userId = req.user.id;
    console.log('📋 Fetching chats for user:', userId);
    
    // Get chats with all messages included
    const chats = await Chat.getUserChats(userId, 50, true);

    console.log(`✅ Found ${chats.length} chats for user`);

    // Format the response with messages
    const formattedChats = chats.map(chat => ({
      id: chat._id,
      sessionId: chat.sessionId,
      title: chat.title,
      lastMessageAt: chat.lastMessageAt,
      totalMessages: chat.totalMessages,
      createdAt: chat.createdAt,
      messages: chat.messages.map(message => ({
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        messageType: message.messageType,
        imageUrl: message.imageUrl
      }))
    }));

    res.json({
      message: 'Chat history retrieved successfully',
      chats: formattedChats,
      totalChats: formattedChats.length
    });

  } catch (error) {
    console.error('❌ Get user chats error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching chat history'
    });
  }
}

// Get specific chat by session ID
async function getChatBySessionId(req, res) {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;
    const chat = await Chat.getChatSessionId(sessionId, userId);

    if (!chat) {
      return res.status(404).json({
        message: 'Chat not found'
      });
    }

    res.json({
      message: 'Chat retrieved successfully',
      chat: {
        sessionId: chat.sessionId,
        title: chat.title,
        messages: chat.messages,
        totalMessages: chat.totalMessages,
        lastMessageAt: chat.lastMessageAt,
        createdAt: chat.createdAt
      }
    });

  } catch (error) {
    console.error('Get chat by session ID error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching chat'
    });
  }
}

// Get specific chat by chat ID with all messages
async function getChatByIdWithMessages(req, res) {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;
    
    console.log('📋 Fetching chat messages for chatId:', chatId, 'userId:', userId);

    // Validate if chatId is a valid MongoDB ObjectId
    if (!chatId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        message: 'Invalid chat ID format'
      });
    }

    const chat = await Chat.findOne({ 
      _id: chatId, 
      user: userId, 
      isActive: true 
    }).select('sessionId title messages totalMessages lastMessageAt createdAt');

    if (!chat) {
      return res.status(404).json({
        message: 'Chat not found'
      });
    }

    console.log(`✅ Found chat with ${chat.messages.length} messages`);

    // Format the response with all messages
    const formattedMessages = chat.messages.map(message => ({
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
      messageType: message.messageType,
      imageUrl: message.imageUrl
    }));

    res.json({
      message: 'Chat messages retrieved successfully',
      chat: {
        chatId: chat._id,
        sessionId: chat.sessionId,
        title: chat.title,
        messages: formattedMessages,
        totalMessages: chat.totalMessages,
        lastMessageAt: chat.lastMessageAt,
        createdAt: chat.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Get chat by ID error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching chat messages'
    });
  }
}

// Create new chat session
async function createNewChat(req, res) {
  try {
    const userId = req.user.id;
    const title = req.body?.title || 'New Chat';
    const chat = await Chat.createChatSession(userId, title);
    res.status(201).json({
      message: 'New chat session created successfully',
      chat: {
        sessionId: chat.sessionId,
        title: chat.title,
        messages: chat.messages,
        totalMessages: chat.totalMessages,
        createdAt: chat.createdAt
      }
    });

  } catch (error) {
    console.error('Create new chat error:', error);
    res.status(500).json({
      message: 'Internal server error while creating chat session'
    });
  }
}

// Personalized fitness query with profile data
async function getPersonalizedFitnessResponse(req, res) {
  try {
    const userId = req.user.id;
    const { prompt, sessionId } = req.body;
    const imageFile = req.file; // For file upload support

    if (!prompt || prompt.trim() === '') {
      return res.status(400).json({
        message: 'Prompt is required'
      });
    }

    if (!sessionId || sessionId.trim() === '') {
      return res.status(400).json({
        message: 'Session ID is required'
      });
    }

    // Get user profile
    const profile = await Profile.findOne({ user: userId });
    if (!profile) {
      return res.status(404).json({
        message: 'Profile not found. Please create your profile first.'
      });
    }

    // Get user health metrics
    const healthMetrics = await HealthMetrics.findOne({ user: userId });

    // Create embedded prompt with user data
    let embeddedPrompt = `I am ${profile.name}`;
    
    if (healthMetrics?.age) {
      embeddedPrompt += `, ${healthMetrics.age} years old`;
    }
    
    if (profile.location) {
      embeddedPrompt += `, living in ${profile.location}`;
    }
    
    if (profile.purposeOfJoining) {
      embeddedPrompt += `. My fitness goal is: ${profile.purposeOfJoining}`;
    }

    // Add health metrics to the prompt
    if (healthMetrics) {
      embeddedPrompt += `\n\nMy current health metrics:
- Height: ${healthMetrics.height} cm
- Weight: ${healthMetrics.weight} kg
- BMI: ${healthMetrics.bmi} (${healthMetrics.getBMICategory()})
- Daily calorie intake: ${healthMetrics.dailyIntakeCalories} calories
- Daily protein intake: ${healthMetrics.dailyIntakeProteins} g
- Daily fat intake: ${healthMetrics.fat} g`;
    } else {
      embeddedPrompt += `\n\nNote: I haven't set up my health metrics yet, so please provide general advice but mention that personalized recommendations would be more accurate with complete health data.`;
    }

    // Add the user's actual query
    embeddedPrompt += `\n\nMy question/request: ${prompt.trim()}`;

    let claudeResponse;

    // Handle image analysis if file is uploaded
    if (imageFile) {
      // For image analysis, use only the user's prompt without profile data
      claudeResponse = await claudeService.analyzeImageWithContext(imageFile.path, prompt.trim());
    } else {
      // For text-only queries, use regular chat system prompt with embedded profile data
      claudeResponse = await claudeService.sendTextMessage([], embeddedPrompt);
    }

    if (claudeResponse.success) {
      // Get or create chat session with provided sessionId
      let chat = await Chat.getChatSessionId(sessionId, userId);
      
      if (!chat) {
        // Create new chat session with the provided sessionId
        chat = await Chat.createChatSession(userId, 'Personalized Fitness Consultation');
        chat.sessionId = sessionId;
        await chat.save();
      }

      // Add messages to chat
      await chat.addMessage('user', prompt.trim(), imageFile ? 'image' : 'text', imageFile ? imageFile.path : null);
      await chat.addMessage('assistant', claudeResponse.content);

      res.json({
        message: 'Personalized fitness response generated successfully',
        response: claudeResponse.content,
        userContext: {
          profile: {
            name: profile.name,
            age: healthMetrics?.age,
            location: profile.location,
            purposeOfJoining: profile.purposeOfJoining
          },
          healthMetrics: healthMetrics ? {
            height: healthMetrics.height,
            weight: healthMetrics.weight,
            bmi: healthMetrics.bmi,
            bmiCategory: healthMetrics.getBMICategory(),
            dailyIntake: {
              calories: healthMetrics.dailyIntakeCalories,
              proteins: healthMetrics.dailyIntakeProteins,
              fat: healthMetrics.fat
            }
          } : null
        },
        chatSessionId: chat.sessionId,
        sessionId: sessionId,
        usage: claudeResponse.usage,
        hasImage: !!imageFile
      });

    } else {
      res.status(500).json({
        message: 'Failed to generate personalized response',
        error: claudeResponse.error
      });
    }

  } catch (error) {
    console.error('Personalized fitness response error:', error);
    res.status(500).json({
      message: 'Internal server error while generating personalized response'
    });
  }
}

// Delete chat session
async function deleteChat(req, res) {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const chat = await Chat.getChatSessionId(sessionId, userId);

    if (!chat) {
      return res.status(404).json({
        message: 'Chat not found'
      });
    }

    chat.isActive = false;
    await chat.save();

    res.json({
      message: 'Chat deleted successfully'
    });

  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({
      message: 'Internal server error while deleting chat'
    });
  }
}

// Update chat title
async function updateChatTitle(req, res) {
  try {
    const { sessionId } = req.params;
    const { title } = req.body;
    const userId = req.user.id;

    if (!title || title.trim() === '') {
      return res.status(400).json({
        message: 'Chat title is required'
      });
    }

    const chat = await Chat.getChatSessionId(sessionId, userId);

    if (!chat) {
      return res.status(404).json({
        message: 'Chat not found'
      });
    }

    chat.title = title.trim();
    await chat.save();

    res.json({
      message: 'Chat title updated successfully',
      title: chat.title
    });

  } catch (error) {
    console.error('Update chat title error:', error);
    res.status(500).json({
      message: 'Internal server error while updating chat title'
    });
  }
}

// Get chat statistics
async function getChatStats(req, res) {
  try {
    const userId = req.user.id;

    const stats = await Chat.aggregate([
      { $match: { user: userId, isActive: true } },
      {
        $group: {
          _id: null,
          totalChats: { $sum: 1 },
          totalMessages: { $sum: '$totalMessages' },
          averageMessagesPerChat: { $avg: '$totalMessages' }
        }
      }
    ]);

    const result = stats[0] || {
      totalChats: 0,
      totalMessages: 0,
      averageMessagesPerChat: 0
    };

    res.json({
      message: 'Chat statistics retrieved successfully',
      stats: result
    });

  } catch (error) {
    console.error('Get chat stats error:', error);
    res.status(500).json({
      message: 'Internal server error while fetching chat statistics'
    });
  }
}

module.exports = {
  getUserChats,
  getChatBySessionId,
  getChatByIdWithMessages,
  createNewChat,
  getPersonalizedFitnessResponse,
  deleteChat,
  updateChatTitle,
  getChatStats
}; 