const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const { generateTitle } = require('../controllers/aiController');

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Protected AI routes
router.use(protect);

// Generate title route
router.post('/generate-title', upload.single('file'), generateTitle);

module.exports = router; 