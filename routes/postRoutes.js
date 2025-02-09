const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/authMiddleware');
const {
    createPost,
    getPosts,
    likePost,
    unlikePost,
    addComment,
    getComments
} = require('../controllers/postController');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/') // Make sure this folder exists
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    // Accept images and videos
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        req.fileValidationError = 'Only image and video files are allowed!';
        cb(new Error('Only image and video files are allowed!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB max-limit for videos
    }
});

// All routes are protected
router.use(protect);

// Post routes
router.route('/')
    .post(upload.array('media', 5), createPost)  // Allow up to 5 files
    .get(getPosts);

// Like/Unlike routes
router.route('/:id/like')
    .post(likePost)
    .delete(unlikePost);

// Comment routes
router.route('/:id/comments')
    .post(addComment)
    .get(getComments);

module.exports = router;