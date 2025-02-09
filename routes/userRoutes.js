const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// Update profile route
router.put('/profile', protect, async (req, res) => {
    try {
        const { dateOfBirth, gender } = req.body;
        const userId = req.user.id;

        const result = await pool.query(
            `UPDATE users 
             SET date_of_birth = $1, gender = $2
             WHERE id = $3
             RETURNING *`,
            [dateOfBirth, gender, userId]
        );

        res.json({
            success: true,
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile'
        });
    }
});

module.exports = router; 