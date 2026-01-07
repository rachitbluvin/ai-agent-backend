const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    return false;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    return true;
  } catch (e) {
    console.error('Mongo connection error:', e.message);
    return false;
  }
};

module.exports = connectDB;

