const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  messageType: {
    type: String,
    enum: ['text', 'image'],
    default: 'text'
  },
  imageUrl: {
    type: String,
    default: null
  }
});

const chatSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    default: 'New Chat'
  },
  messages: [messageSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  totalMessages: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for faster queries
chatSchema.index({ user: 1, lastMessageAt: -1 });

// Method to add a message
chatSchema.methods.addMessage = function(role, content, messageType = 'text', imageUrl = null) {
  const message = {
    role,
    content,
    messageType,
    imageUrl,
    timestamp: new Date()
  };
  
  this.messages.push(message);
  this.lastMessageAt = new Date();
  this.totalMessages = this.messages.length;
  
  return this.save();
};

// Method to get conversation history for Claude API
chatSchema.methods.getConversationHistory = function() {
  return this.messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
};

// Method to get recent messages (last N messages)
chatSchema.methods.getRecentMessages = function(limit = 10) {
  return this.messages.slice(-limit);
};

// Static method to create new chat session
chatSchema.statics.createChatSession = async function(userId, title = 'New Chat') {
  const sessionId = `chat_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  return this.create({
    user: userId,
    sessionId,
    title,
    messages: []
  });
};

// Static method to get user's active chats
chatSchema.statics.getUserChats = async function(userId, limit = 20, includeMessages = true) {
  const selectFields = includeMessages 
    ? 'sessionId title lastMessageAt totalMessages createdAt messages'
    : 'sessionId title lastMessageAt totalMessages createdAt';
    
  return this.find({ user: userId, isActive: true })
    .sort({ lastMessageAt: -1 })
    .limit(limit)
    .select(selectFields);
};

// Static method to get chat by session ID
chatSchema.statics.getChatSessionId = async function(sessionId, userId) {
  return this.findOne({ sessionId, user: userId, isActive: true });
};

module.exports = mongoose.model('Chat', chatSchema); 