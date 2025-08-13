const express = require('express');
const router = express.Router();
const multer = require('multer');
// const path = require('path');
const {
  getUserChats,
  getChatBySessionId,
  getChatByIdWithMessages,
  createNewChat,
  getPersonalizedFitnessResponse,
  deleteChat,
  updateChatTitle,
  getChatStats
} = require('../controllers/chatController');
const protect = require('../middleware/authMiddleware');

// Configure multer for memory storage (temporary)
const fileFilter = (req, file, cb) => {
  // Accept only image files
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: multer.memoryStorage(), // Store in memory temporarily
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// All chat routes require authentication
router.use(protect);

// Error handling middleware for file uploads
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File too large. Maximum size is 5MB.'
      });
    }
    return res.status(400).json({
      message: 'File upload error: ' + error.message
    });
  } else if (error) {
    return res.status(400).json({
      message: error.message
    });
  }
  next();
});

// Chat management routes
router.get('/allChats', getUserChats);
router.get('/chats/:sessionId', getChatBySessionId);
router.get('/id/:chatId', getChatByIdWithMessages);
router.post('/new-chat', createNewChat);
router.post('/personalized-response', upload.single('image'), getPersonalizedFitnessResponse);
router.delete('/chats/:sessionId', deleteChat);
router.put('/chats/:sessionId/title', updateChatTitle);
router.get('/stats', getChatStats);

module.exports = router; 