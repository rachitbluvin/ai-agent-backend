const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

const register = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide all fields' });
        }

        const isConnected = mongoose.connection && mongoose.connection.readyState === 1;
        if (!isConnected) {
            return res.status(500).json({ success: false, message: 'Database not configured' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        const created = await User.create({
            username,
            email,
            password: hashedPassword,
        });

        const token = jwt.sign({ id: created._id.toString(), email: created.email }, process.env.JWT_SECRET, {
            expiresIn: '30d',
        });

        res.status(201).json({
            success: true,
            data: {
                id: created._id.toString(),
                username: created.username,
                email: created.email,
                token,
            },
        });
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }

        const isConnected = mongoose.connection && mongoose.connection.readyState === 1;
        if (!isConnected) {
            return res.status(500).json({ success: false, message: 'Database not configured' });
        }

        const user = await User.findOne({ email });

        if (user && (await bcrypt.compare(password, user.password))) {
             const token = jwt.sign({ id: user._id.toString(), email: user.email }, process.env.JWT_SECRET, {
                expiresIn: '30d',
            });

            res.json({
                success: true,
                data: {
                    id: user._id.toString(),
                    username: user.username,
                    email: user.email,
                    token,
                },
            });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (error) {
        next(error);
    }
};

module.exports = {
    register,
    login,
};
