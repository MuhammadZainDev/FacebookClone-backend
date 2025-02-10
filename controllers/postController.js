const pool = require('../config/db');
const cloudinary = require('../config/cloudinary');
const fs = require('fs');

// Create a new post
const createPost = async (req, res) => {
    try {
        // Log incoming request data
        console.log('Request body:', req.body);
        console.log('Files:', req.files);

        const { content, privacy, post_type, feeling, location } = req.body;
        const userId = req.user.id;
        
        // Handle uploaded files
        const mediaUrls = [];
        const mediaTypes = [];

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    // Determine if file is video or image based on mimetype
                    const isVideo = file.mimetype.startsWith('video/');
                    
                    // Upload to Cloudinary with appropriate settings
                    const uploadResult = await cloudinary.uploader.upload(file.path, {
                        resource_type: isVideo ? 'video' : 'image',
                        folder: isVideo ? 'videos' : 'images',
                        // For videos, generate a thumbnail
                        ...(isVideo && {
                            eager: [
                                { width: 300, height: 300, crop: "pad", audio_codec: "none" },
                                { width: 160, height: 100, crop: "crop", gravity: "south", audio_codec: "none" }
                            ],
                            eager_async: true,
                            eager_notification_url: "https://mysite.example.com/notify_endpoint"
                        })
                    });

                    // Add the URL to our array
                    mediaUrls.push(uploadResult.secure_url);
                    mediaTypes.push(isVideo ? 'video' : 'image');

                    // Delete the temporary file
                    fs.unlinkSync(file.path);
                } catch (uploadError) {
                    console.error('Error uploading file to Cloudinary:', uploadError);
                    // Continue with other files even if one fails
                }
            }
        }
        
        console.log('Media URLs:', mediaUrls);
        console.log('Media Types:', mediaTypes);
        console.log('Content:', content);

        const result = await pool.query(
            `INSERT INTO posts (user_id, content, media, media_types, privacy, post_type, feeling, location)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                userId, 
                content || null, 
                mediaUrls, 
                mediaTypes,
                privacy || 'public', 
                post_type || 'text',
                feeling || null,
                location || null
            ]
        );

        console.log('Inserted post:', result.rows[0]);

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error in createPost:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating post',
            error: error.message
        });
    }
};

// Get all posts
const getPosts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const result = await pool.query(
            `SELECT 
                p.*,
                u.first_name,
                u.last_name,
                u.profile_picture,
                COALESCE(pl.likes_count, 0) as likes_count,
                COALESCE(pc.comments_count, 0) as comments_count,
                EXISTS (
                    SELECT 1 FROM post_likes 
                    WHERE post_id = p.id AND user_id = $1
                ) as is_liked
            FROM posts p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN (
                SELECT post_id, COUNT(*) as likes_count 
                FROM post_likes 
                GROUP BY post_id
            ) pl ON p.id = pl.post_id
            LEFT JOIN (
                SELECT post_id, COUNT(*) as comments_count 
                FROM post_comments 
                GROUP BY post_id
            ) pc ON p.id = pc.post_id
            ORDER BY p.created_at DESC
            LIMIT $2 OFFSET $3`,
            [req.user.id, limit, offset]
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching posts'
        });
    }
};

// Like a post
const likePost = async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.id;

        // First check if user has already liked the post
        const existingLike = await pool.query(
            'SELECT * FROM post_likes WHERE post_id = $1 AND user_id = $2',
            [postId, userId]
        );

        if (existingLike.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Post already liked'
            });
        }

        // Add the like
        await pool.query(
            'INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)',
            [postId, userId]
        );

        // Get updated like count
        const likeCount = await pool.query(
            'SELECT COUNT(*) as count FROM post_likes WHERE post_id = $1',
            [postId]
        );

        res.json({
            success: true,
            likesCount: parseInt(likeCount.rows[0].count)
        });
    } catch (error) {
        console.error('Error liking post:', error);
        res.status(500).json({
            success: false,
            message: 'Error liking post'
        });
    }
};

// Unlike a post
const unlikePost = async (req, res) => {
    try {
        const postId = req.params.id;
        const userId = req.user.id;

        // Remove the like
        await pool.query(
            'DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2',
            [postId, userId]
        );

        // Get updated like count
        const likeCount = await pool.query(
            'SELECT COUNT(*) as count FROM post_likes WHERE post_id = $1',
            [postId]
        );

        res.json({
            success: true,
            likesCount: parseInt(likeCount.rows[0].count)
        });
    } catch (error) {
        console.error('Error unliking post:', error);
        res.status(500).json({
            success: false,
            message: 'Error unliking post'
        });
    }
};

// Add comment
const addComment = async (req, res) => {
    try {
        const { content } = req.body;
        const postId = req.params.id;
        const userId = req.user.id;

        const result = await pool.query(
            `INSERT INTO post_comments (post_id, user_id, content)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [postId, userId, content]
        );

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error adding comment'
        });
    }
};

// Get comments
const getComments = async (req, res) => {
    try {
        const postId = req.params.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const result = await pool.query(
            `SELECT pc.*, u.first_name, u.last_name
             FROM post_comments pc
             LEFT JOIN users u ON pc.user_id = u.id
             WHERE pc.post_id = $1
             ORDER BY pc.created_at DESC
             LIMIT $2 OFFSET $3`,
            [postId, limit, offset]
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching comments'
        });
    }
};

module.exports = {
    createPost,
    getPosts,
    likePost,
    unlikePost,
    addComment,
    getComments
};