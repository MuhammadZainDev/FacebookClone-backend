const express = require('express');
const router = express.Router();
const { 
    getSuggestions, 
    sendRequest, 
    getPendingRequests, 
    acceptRequest, 
    rejectRequest,
    getAllFriends,
    unfriend 
} = require('../controllers/friendController');
const { protect } = require('../middleware/authMiddleware');

// Friend routes
router.get('/suggestions', protect, getSuggestions);
router.post('/request', protect, sendRequest);
router.get('/requests', protect, getPendingRequests);
router.put('/accept/:requestId', protect, acceptRequest);
router.put('/reject/:requestId', protect, rejectRequest);
router.get('/all', protect, getAllFriends);
router.delete('/unfriend/:friendId', protect, unfriend);

module.exports = router; 