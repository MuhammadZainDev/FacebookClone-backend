const pool = require('../config/db');

// Get friend suggestions
exports.getSuggestions = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Updated query to show users including those who had rejected requests
        const query = `
            SELECT 
                u.id, 
                u.first_name, 
                u.last_name, 
                u.profile_picture,
                (
                    SELECT COUNT(*)
                    FROM friendships f1
                    WHERE f1.status = 'accepted'
                    AND (
                        (f1.sender_id = $1 AND f1.receiver_id IN (
                            SELECT CASE 
                                WHEN f2.sender_id = u.id THEN f2.receiver_id
                                ELSE f2.sender_id
                            END
                            FROM friendships f2
                            WHERE f2.status = 'accepted'
                            AND (f2.sender_id = u.id OR f2.receiver_id = u.id)
                        ))
                        OR 
                        (f1.receiver_id = $1 AND f1.sender_id IN (
                            SELECT CASE 
                                WHEN f2.sender_id = u.id THEN f2.receiver_id
                                ELSE f2.sender_id
                            END
                            FROM friendships f2
                            WHERE f2.status = 'accepted'
                            AND (f2.sender_id = u.id OR f2.receiver_id = u.id)
                        ))
                    )
                ) as mutual_friends
            FROM users u
            WHERE u.id != $1
            AND NOT EXISTS (
                -- Only exclude users with pending or accepted friendships
                SELECT 1 FROM friendships f 
                WHERE (
                    (f.sender_id = $1 AND f.receiver_id = u.id)
                    OR 
                    (f.receiver_id = $1 AND f.sender_id = u.id)
                )
                AND f.status IN ('pending', 'accepted')
            )
            ORDER BY mutual_friends DESC, RANDOM()
            LIMIT 10
        `;

        console.log('Executing suggestions query for user:', userId);
        
        const suggestions = await pool.query(query, [userId]);
        
        console.log('Found suggestions:', suggestions.rows.length);
        
        res.json(suggestions.rows);
    } catch (err) {
        console.error('Error in getSuggestions:', err);
        res.status(500).json({ message: 'Server error in getting suggestions' });
    }
};

// Send friend request
exports.sendRequest = async (req, res) => {
    try {
        const senderId = req.user.id;
        const { receiverId } = req.body;

        // Check for existing active friendship (only pending or accepted)
        const existingRequest = await pool.query(
            'SELECT * FROM friendships WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) AND status IN ($3, $4)',
            [senderId, receiverId, 'pending', 'accepted']
        );

        if (existingRequest.rows.length > 0) {
            const status = existingRequest.rows[0].status;
            if (status === 'pending') {
                return res.status(400).json({ message: 'Friend request already exists' });
            } else if (status === 'accepted') {
                return res.status(400).json({ message: 'Already friends' });
            }
        }

        // If no active request exists, create new request
        await pool.query(
            'INSERT INTO friendships (sender_id, receiver_id, status) VALUES ($1, $2, $3)',
            [senderId, receiverId, 'pending']
        );

        res.json({ message: 'Friend request sent successfully' });
    } catch (err) {
        console.error('Error in sendRequest:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get pending friend requests
exports.getPendingRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const query = `
            SELECT 
                u.id, 
                u.first_name, 
                u.last_name, 
                u.profile_picture,
                f.id as request_id,
                f.created_at,
                f.sender_id,  -- Added this to track who sent the request
                (
                    SELECT COUNT(*)
                    FROM friendships f2
                    WHERE f2.status = 'accepted'
                    AND (
                        (f2.sender_id = f.sender_id AND f2.receiver_id = ANY(
                            SELECT CASE 
                                WHEN f3.sender_id = $1 THEN f3.receiver_id
                                ELSE f3.sender_id
                            END
                            FROM friendships f3
                            WHERE f3.status = 'accepted'
                            AND (f3.sender_id = $1 OR f3.receiver_id = $1)
                        ))
                        OR 
                        (f2.receiver_id = f.sender_id AND f2.sender_id = ANY(
                            SELECT CASE 
                                WHEN f3.sender_id = $1 THEN f3.receiver_id
                                ELSE f3.sender_id
                            END
                            FROM friendships f3
                            WHERE f3.status = 'accepted'
                            AND (f3.sender_id = $1 OR f3.receiver_id = $1)
                        ))
                    )
                ) as mutual_friends
            FROM friendships f
            JOIN users u ON f.sender_id = u.id
            WHERE f.receiver_id = $1 
            AND f.status = 'pending'
            ORDER BY f.created_at DESC
        `;
        
        console.log('Fetching pending requests for user:', userId); // Debug log
        
        const requests = await pool.query(query, [userId]);
        
        console.log('Found pending requests:', requests.rows.length); // Debug log
        console.log('Pending requests data:', requests.rows); // Debug log
        
        res.json(requests.rows);
    } catch (err) {
        console.error('Error in getPendingRequests:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Accept friend request
exports.acceptRequest = async (req, res) => {
    try {
        const userId = req.user.id;
        const { requestId } = req.params;

        const result = await pool.query(
            'UPDATE friendships SET status = $1 WHERE id = $2 AND receiver_id = $3 RETURNING *',
            ['accepted', requestId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Friend request not found' });
        }

        res.json({ message: 'Friend request accepted' });
    } catch (err) {
        console.error('Error in acceptRequest:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Reject friend request
exports.rejectRequest = async (req, res) => {
    try {
        const userId = req.user.id;
        const { requestId } = req.params;

        // First verify this request exists and is for this user
        const checkRequest = await pool.query(
            'SELECT * FROM friendships WHERE id = $1 AND receiver_id = $2',
            [requestId, userId]
        );

        if (checkRequest.rows.length === 0) {
            return res.status(404).json({ message: 'Friend request not found' });
        }

        // Instead of updating status to rejected, delete the record
        await pool.query(
            'DELETE FROM friendships WHERE id = $1',
            [requestId]
        );

        res.json({ message: 'Friend request rejected' });
    } catch (err) {
        console.error('Error in rejectRequest:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get all friends
exports.getAllFriends = async (req, res) => {
    try {
        const userId = req.user.id;
        const query = `
            SELECT 
                CASE 
                    WHEN f.sender_id = $1 THEN u.id
                    ELSE u.id
                END as friend_id,
                u.id,
                u.first_name,
                u.last_name,
                u.profile_picture,
                f.created_at,
                (
                    SELECT COUNT(*)
                    FROM friendships f2
                    WHERE f2.status = 'accepted'
                    AND (
                        (f2.sender_id = u.id AND f2.receiver_id IN (
                            SELECT CASE 
                                WHEN f3.sender_id = $1 THEN f3.receiver_id
                                ELSE f3.sender_id
                            END
                            FROM friendships f3
                            WHERE f3.status = 'accepted'
                            AND (f3.sender_id = $1 OR f3.receiver_id = $1)
                        ))
                        OR 
                        (f2.receiver_id = u.id AND f2.sender_id IN (
                            SELECT CASE 
                                WHEN f3.sender_id = $1 THEN f3.receiver_id
                                ELSE f3.sender_id
                            END
                            FROM friendships f3
                            WHERE f3.status = 'accepted'
                            AND (f3.sender_id = $1 OR f3.receiver_id = $1)
                        ))
                    )
                ) as mutual_friends
            FROM friendships f
            JOIN users u ON (
                CASE 
                    WHEN f.sender_id = $1 THEN f.receiver_id = u.id
                    ELSE f.sender_id = u.id
                END
            )
            WHERE (f.sender_id = $1 OR f.receiver_id = $1)
            AND f.status = 'accepted'
            ORDER BY f.created_at DESC
        `;
        const friends = await pool.query(query, [userId]);
        res.json(friends.rows);
    } catch (err) {
        console.error('Error in getAllFriends:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Unfriend functionality
exports.unfriend = async (req, res) => {
    try {
        const userId = req.user.id;
        const { friendId } = req.params;

        // First verify they are actually friends
        const checkFriendship = await pool.query(
            `SELECT * FROM friendships 
            WHERE ((sender_id = $1 AND receiver_id = $2) 
            OR (sender_id = $2 AND receiver_id = $1))
            AND status = 'accepted'`,
            [userId, friendId]
        );

        if (checkFriendship.rows.length === 0) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        // Delete the friendship
        await pool.query(
            `DELETE FROM friendships 
            WHERE (sender_id = $1 AND receiver_id = $2) 
            OR (sender_id = $2 AND receiver_id = $1)`,
            [userId, friendId]
        );

        res.json({ message: 'Friend removed successfully' });
    } catch (err) {
        console.error('Error in unfriend:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
