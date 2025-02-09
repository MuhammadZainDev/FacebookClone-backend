const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

// Get user profile
exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const result = await pool.query(
            'SELECT id, first_name, last_name, email, date_of_birth, gender, profile_picture FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error in getProfile:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update user profile
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { first_name, last_name, date_of_birth, gender, profile_picture } = req.body;

        const result = await pool.query(
            `UPDATE users 
             SET first_name = $1, 
                 last_name = $2, 
                 date_of_birth = $3, 
                 gender = $4,
                 profile_picture = $5,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6
             RETURNING id, first_name, last_name, email, date_of_birth, gender, profile_picture`,
            [first_name, last_name, date_of_birth, gender, profile_picture, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error in updateProfile:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update profile picture
exports.updateProfilePicture = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const userId = req.user.id;
        const filePath = `/uploads/profiles/${req.file.filename}`;

        // Get old profile picture to delete
        const oldPicture = await pool.query(
            'SELECT profile_picture FROM users WHERE id = $1',
            [userId]
        );

        // Update database with new picture path
        const result = await pool.query(
            `UPDATE users 
             SET profile_picture = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING id, first_name, last_name, email, date_of_birth, gender, profile_picture`,
            [filePath, userId]
        );

        // Delete old profile picture if it exists
        if (oldPicture.rows[0]?.profile_picture) {
            const oldPath = path.join(__dirname, '..', oldPicture.rows[0].profile_picture);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error in updateProfilePicture:', err);
        res.status(500).json({ message: 'Server error' });
    }
}; 