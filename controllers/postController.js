const pool = require('../config/db');

// Create a new post
const createPost = async (req, res) => {
    try {
        // Log incoming request data
        console.log('Request body:', req.body);
        console.log('Files:', req.files);

        const { content, privacy, post_type, feeling, location } = req.body;
        const userId = req.user.id;
        
        // Handle uploaded files
        const mediaUrls = req.files ? req.files.map(file => `http://localhost:5000/uploads/${file.filename}`) : [];
        
        console.log('Media URLs:', mediaUrls);
        console.log('Content:', content);

        const result = await pool.query(
            `INSERT INTO posts (user_id, content, media, privacy, post_type, feeling, location)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                userId, 
                content || null, 
                mediaUrls, 
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
            `SELECT p.*, 
                u.first_name, 
                u.last_name,
                COUNT(DISTINCT pl.id) as likes_count,
                COUNT(DISTINCT pc.id) as comments_count,
                EXISTS (
                    SELECT 1 FROM post_likes 
                    WHERE post_id = p.id AND user_id = $1
                ) as is_liked
             FROM posts p
             LEFT JOIN users u ON p.user_id = u.id
             LEFT JOIN post_likes pl ON p.id = pl.post_id
             LEFT JOIN post_comments pc ON p.id = pc.post_id
             GROUP BY p.id, u.first_name, u.last_name
             ORDER BY p.created_at DESC
             LIMIT $2 OFFSET $3`,
            [req.user.id, limit, offset]
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
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

        const result = await pool.query(
            `INSERT INTO post_likes (post_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (post_id, user_id) DO NOTHING
             RETURNING *`,
            [postId, userId]
        );

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
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

        const result = await pool.query(
            `DELETE FROM post_likes
             WHERE post_id = $1 AND user_id = $2
             RETURNING *`,
            [postId, userId]
        );

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
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