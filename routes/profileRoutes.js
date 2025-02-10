const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, updateProfilePicture } = require('../controllers/profileController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const pool = require('../config/db');

router.get('/', protect, getProfile);
router.put('/update', protect, async (req, res) => {
    try {
        const { first_name, last_name, email, date_of_birth, gender } = req.body;
        const userId = req.user.id;

        // Update user profile
        const result = await pool.query(
            `UPDATE users 
             SET first_name = $1, 
                 last_name = $2, 
                 email = $3, 
                 date_of_birth = $4, 
                 gender = $5
             WHERE id = $6
             RETURNING *`,
            [first_name, last_name, email, date_of_birth, gender, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Remove sensitive information before sending response
        const user = result.rows[0];
        delete user.password;

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile',
            error: error.message
        });
    }
});
router.post('/upload-photo', protect, upload.single('profile_picture'), updateProfilePicture);

module.exports = router; 