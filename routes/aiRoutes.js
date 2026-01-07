const express = require('express');
const router = express.Router();
const { generateCode, generateProject } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

router.post('/generate', protect, generateCode);
router.post('/generate-project', protect, generateProject);

module.exports = router;
