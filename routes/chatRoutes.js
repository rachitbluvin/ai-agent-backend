const express = require('express');
const router = express.Router();
const { listChats, startChat, getChat } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, listChats);
router.post('/start', protect, startChat);
router.get('/:id', protect, getChat);

module.exports = router;

