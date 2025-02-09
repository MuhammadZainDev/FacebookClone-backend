const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// Verify Google token and check if user exists
const googleVerify = async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required'
            });
        }

        // Verify the Google token
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        
        const payload = ticket.getPayload();
        console.log('Google payload:', payload);
        
        const { email, given_name, family_name, picture } = payload;

        // Check if user exists
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length > 0) {
            // User exists - generate token and return user data
            const user = result.rows[0];
            const token = generateToken(user.id);

            return res.json({
                success: true,
                isNewUser: false,
                token,
                user
            });
        }

        // New user - return Google data
        const userData = {
            email: email,
            firstName: given_name || '',
            lastName: family_name || '',
            profilePicture: picture || null
        };

        console.log('Sending user data for new user:', userData);

        return res.json({
            success: true,
            isNewUser: true,
            userData
        });
    } catch (error) {
        console.error('Google verification error:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid Google token',
            error: error.message
        });
    }
};

// Complete Google signup with additional info
const completeGoogleSignup = async (req, res) => {
    try {
        console.log('Received signup data:', req.body);
        
        const {
            email,
            firstName,
            lastName,
            profilePicture,
        } = req.body;

        // Validate required fields
        if (!email || !firstName) {
            console.log('Missing required fields:', { email, firstName });
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                received: { email, firstName }
            });
        }

        // Check if user already exists
        const existingUser = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            console.log('User already exists:', email);
            const user = existingUser.rows[0];
            const token = generateToken(user.id);
            return res.json({
                success: true,
                token,
                user
            });
        }

        console.log('Creating new user with:', {
            email,
            firstName,
            lastName: lastName || '',
            profilePicture: profilePicture ? 'exists' : 'not provided'
        });

        // Create default values for required fields
        const defaultPassword = await bcrypt.hash('google_user_' + Date.now(), 10);
        const currentDate = new Date().toISOString().split('T')[0];

        // Insert new user with default values for required fields
        const result = await pool.query(
            `INSERT INTO users (
                email, 
                first_name, 
                last_name, 
                profile_picture,
                is_google_user,
                password,
                date_of_birth,
                gender
            )
            VALUES ($1, $2, $3, $4, true, $5, $6, NULL)
            RETURNING *`,
            [
                email, 
                firstName, 
                lastName || '', 
                profilePicture,
                defaultPassword,
                currentDate // Default date_of_birth to current date
            ]
        );

        const user = result.rows[0];
        const token = generateToken(user.id);

        console.log('User created successfully:', {
            userId: user.id,
            email: user.email
        });

        res.status(201).json({
            success: true,
            token,
            user
        });
    } catch (error) {
        console.error('Complete Google signup error:', error);
        res.status(500).json({
            success: false,
            message: 'Error completing Google signup',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// Regular register
const register = async (req, res) => {
    try {
        const { firstName, lastName, email, password, dateOfBirth, gender } = req.body;

        // Check if user exists
        const userExists = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const result = await pool.query(
            `INSERT INTO users (
                first_name, 
                last_name, 
                email, 
                password,
                date_of_birth,
                gender,
                is_google_user
            )
            VALUES ($1, $2, $3, $4, $5, $6, false)
            RETURNING *`,
            [firstName, lastName, email, hashedPassword, dateOfBirth, gender]
        );

        const user = result.rows[0];
        const token = generateToken(user.id);

        res.status(201).json({
            success: true,
            token,
            user
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Error in registration',
            error: error.message
        });
    }
};

// Regular login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check for user
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const user = result.rows[0];

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate JWT
        const token = generateToken(user.id);

        res.json({
            success: true,
            token,
            user
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Error in login',
            error: error.message
        });
    }
};

module.exports = {
    register,
    login,
    googleVerify,
    completeGoogleSignup
};