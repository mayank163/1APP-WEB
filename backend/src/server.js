const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const app = express();
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const fs = require('fs');

const http = require('http');
const server = http.createServer(app);

const {Server} = require('socket.io');

// Import routes
const authRoutes = require('./routes/authRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminTechnicianRoutes = require('./routes/adminTechnicianRoutes');
const adminVerificationRoutes = require('./routes/adminVerificationRoutes');
const technicianRoutes = require('./routes/technicianRoutes');
const technicianAuthRoutes = require('./routes/technicianAuthRoutes');
const blogRoutes = require('./routes/blogRoutes');
const cartRoutes = require('./routes/cartRoutes');
const Service = require('./models/Service');

// Import middleware
const { xssProtection } = require('./middleware/security');

const dns = require('dns');
// Set DNS servers. Using Cloudflare and Google DNS.
dns.setServers(['1.1.1.1', '8.8.8.8']);
// Database connection

mongoose.connect(process.env.MONGODB_URI)
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

if (fs.existsSync(uploadsPath)) {
    const files = fs.readdirSync(uploadsPath);
    console.log('📁 Files in uploads:', files);
} else {
    console.log('❌ Uploads folder not found! Creating...');
    fs.mkdirSync(uploadsPath, { recursive: true });
}

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: false
    },
    pingInterval: 25000,
    pingTimeout: 60000,
    transports: ['websocket', 'polling']
});

// Make io accessible across the app without circular imports
const { setIO } = require('./utils/socketInstance');
setIO(io);


// ========== SERVE STATIC FILES ==========
app.use('/uploads', express.static(uploadsPath));
console.log('✅ Serving static files from:', uploadsPath);

// Security middleware
app.use(helmet());
app.use(cors({
    // origin: ['http://1app-frontend.s3-website-us-west-1.amazonaws.com','http://1app-admin.s3-website-us-west-1.amazonaws.com','*','http://localhost:3000','http://localhost:3001'],
    origin: '*',
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
app.use('/api/admin', adminTechnicianRoutes);
app.use('/api/admin', adminVerificationRoutes);
app.use('/api/technician', technicianRoutes);
app.use('/api/technician-auth', technicianAuthRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/cart', cartRoutes);

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



io.on("connection", (socket) => {

    console.log("User Connected:", socket.id);

    // Send welcome message to this client
    socket.emit("welcome", {
        message: "Welcome from Backend"
    });

    // Listen for message from frontend
    socket.on("sendMessage", (data) => {

        console.log("Received:", data);

        socket.emit("reply", {
            message: "Backend received your message"
        });

    });

    // Join/leave request-scoped rooms for live chat & status updates
    socket.on('request:join', (requestId) => {
        if (requestId) {
            socket.join(`request:${requestId}`);
            console.log(`[Socket] ${socket.id} joined request room: ${requestId}`);
        }
    });

    socket.on('request:leave', (requestId) => {
        if (requestId) {
            socket.leave(`request:${requestId}`);
            console.log(`[Socket] ${socket.id} left request room: ${requestId}`);
        }
    });

    // Admin joins a global room to receive job-level broadcasts
    socket.on('admin:join', () => {
        socket.join('admin');
        console.log(`[Socket] ${socket.id} joined admin room`);
    });

    socket.on('admin:leave', () => {
        socket.leave('admin');
        console.log(`[Socket] ${socket.id} left admin room`);
    });

    // Technician joins their own room to receive verification updates
    socket.on('technician:join', (technicianId) => {
        if (technicianId) {
            socket.join(`technician:${technicianId}`);
            console.log(`[Socket] ${socket.id} joined technician room: ${technicianId}`);
        }
    });

    socket.on('technician:leave', (technicianId) => {
        if (technicianId) {
            socket.leave(`technician:${technicianId}`);
            console.log(`[Socket] ${socket.id} left technician room: ${technicianId}`);
        }
    });

    socket.on("disconnect", () => {
        console.log("User Disconnected:", socket.id);
    });

});

const PORT = process.env.PORT;

server.listen(PORT , () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV}`);
});
