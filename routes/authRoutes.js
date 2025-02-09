const express = require('express');
const router = express.Router();
const { 
    register, 
    login, 
    googleVerify,
    completeGoogleSignup
} = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/google-verify', googleVerify);
router.post('/complete-google-signup', completeGoogleSignup);

module.exports = router;