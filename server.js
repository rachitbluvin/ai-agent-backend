const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();
const aiRoutes = require('./routes/aiRoutes');
const authRoutes = require('./routes/authRoutes');
const errorHandler = require('./middleware/errorHandler');
const connectDB = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/chat', require('./routes/chatRoutes'));

// Error Handler
app.use(errorHandler);

const start = async () => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
  const connected = await connectDB();
  if (connected) {
    console.log('MongoDB connected');
  } else {
    console.log('MongoDB not configured or connection failed');
  }
};

start();
