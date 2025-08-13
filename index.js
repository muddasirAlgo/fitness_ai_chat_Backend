// index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes.js');
const healthRoutes = require('./routes/healthRoutes.js');
const chatRoutes = require('./routes/chatRoutes.js');
const mealRoutes = require('./routes/mealRoutes.js');
const workoutRoutes = require('./routes/workoutRoutes.js');
const waterSleepRoutes = require('./routes/waterSleepRoutes.js');
const activityRoutes = require('./routes/activityRoutes.js');
const mindfulnessRoutes = require('./routes/mindfulnessRoutes.js');
const dailyMetricsRoutes = require('./routes/dailyMetricsRoutes.js');
const ChatSocket = require('./socket/chatSocket.js');
const cors = require('cors');

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
    // credentials: true
  }
});

// Initialize chat socket
const chatSocket = new ChatSocket(io);

// Middleware
app.use(cors());
app.use(express.json()); // Ensure this is before routes
app.use('/uploads', express.static('uploads')); // Serve uploaded files
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/meals', mealRoutes);
app.use('/api/v1/workouts', workoutRoutes);
app.use('/api/v1/water-sleep', waterSleepRoutes);
app.use('/api/v1/activities', activityRoutes);
app.use('/api/v1/mindfulness', mindfulnessRoutes);
app.use('/api/v1/daily-metrics', dailyMetricsRoutes);
app.use(errorHandler); // Custom error middleware

app.get('/', (req, res) => {
    return res.status(200).json({
        message: "Hello World",
    })
});

app.use((req, res) => {
    return res.status(404).json({
      error: true,
      message: "route not found",
    })
});

const PORT = process.env.PORT || 3000; 
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

