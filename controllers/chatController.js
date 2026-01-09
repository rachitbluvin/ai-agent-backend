const mongoose = require('mongoose');
const Chat = require('../models/Chat');

const listChats = async (req, res, next) => {
  try {
    const isConnected = mongoose.connection && mongoose.connection.readyState === 1;
    if (!isConnected) {
      return res.status(500).json({ success: false, message: 'Database not configured' });
    }
    const chats = await Chat.find({ user: req.user.id }).select('_id title createdAt updatedAt').sort({ updatedAt: -1 });
    res.json({ success: true, data: chats });
  } catch (e) {
    next(e);
  }
};

const startChat = async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });
    const chat = await Chat.create({ user: req.user.id, title, messages: [] });
    res.status(201).json({ success: true, data: { id: chat._id.toString(), title: chat.title } });
  } catch (e) {
    next(e);
  }
};

const getChat = async (req, res, next) => {
  try {
    const { id } = req.params;
    const chat = await Chat.findOne({ _id: id, user: req.user.id });
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
    res.json({ success: true, data: chat });
  } catch (e) {
    next(e);
  }
};

module.exports = { listChats, startChat, getChat };

