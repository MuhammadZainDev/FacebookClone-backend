const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// Register User
const registerUser = async (req, res) => {
    try {
        const { firstName, lastName, email, password, dateOfBirth, gender } = req.body;

        // Check if user exists
        const userExists = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        if (userExists.rows.length > 0) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const result = await pool.query(
            `INSERT INTO users (first_name, last_name, email, password, date_of_birth, gender)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, first_name, last_name, email`,
            [firstName, lastName, email, hashedPassword, dateOfBirth, gender]
        );

        const newUser = result.rows[0];

        res.status(201).json({
            id: newUser.id,
            firstName: newUser.first_name,
            lastName: newUser.last_name,
            email: newUser.email,
            token: generateToken(newUser.id)
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Login User
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check for user email
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        const user = result.rows[0];

        if (user && (await bcrypt.compare(password, user.password))) {
            res.json({
                id: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                token: generateToken(user.id)
            });
        } else {
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    registerUser,
    loginUser
};