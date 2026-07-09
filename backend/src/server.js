const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const fs = require('fs');

// Import routes
const authRoutes = require('./routes/authRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const blogRoutes = require('./routes/blogRoutes');
const Service = require('./models/Service');

// Import middleware
const { xssProtection } = require('./middleware/security');

const app = express();
const dns = require('dns');
// Set DNS servers. Using Cloudflare and Google DNS.
dns.setServers(['1.1.1.1', '8.8.8.8']);
// Database connection

mongoose.connect('mongodb://127.0.0.1:27017/vmarc')
    .then(async () => {
        console.log('✅ MongoDB connected successfully');
        try {
            await Service.collection.dropIndex('name_1');
            console.log('Removed old unique service name index');
        } catch (err) {
            if (err.codeName !== 'IndexNotFound') {
                console.warn('Could not remove old service name index:', err.message);
            }
        }
    })
    .catch(err => console.error('❌ MongoDB connection error:', err));


// ========== UPLOADS FOLDER - SAHI PATH ==========
// ✅ Uploads src folder mein hai
const uploadsPath = path.join(__dirname, '..', 'uploads');
console.log('📁 Uploads path:', uploadsPath);
console.log('📁 Uploads exists:', fs.existsSync(uploadsPath));

if (fs.existsSync(uploadsPath)) {
    const files = fs.readdirSync(uploadsPath);
    console.log('📁 Files in uploads:', files);
} else {
    console.log('❌ Uploads folder not found! Creating...');
    fs.mkdirSync(uploadsPath, { recursive: true });
}

// ========== SERVE STATIC FILES ==========
app.use('/uploads', express.static(uploadsPath));
console.log('✅ Serving static files from:', uploadsPath);

// Security middleware
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// // Rate limiting
// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 100,
//     message: 'Too many requests from this IP, please try again later.'
// });
// app.use('/api', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization
// app.use(mongoSanitize());
app.use(xssProtection);



// Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/blogs', blogRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV}`);
});
