const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 6, fileSize: 5 * 1024 * 1024 } });
const { generateCode, generateProject, send } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

router.post('/generate', protect, generateCode);
router.post('/generate-project', protect, generateProject);
router.post('/send', protect, upload.array('files', 6), send);

module.exports = router;
