const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, updateProfilePicture } = require('../controllers/profileController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/', protect, getProfile);
router.put('/update', protect, updateProfile);
router.post('/upload-photo', protect, upload.single('profile_picture'), updateProfilePicture);

module.exports = router; 