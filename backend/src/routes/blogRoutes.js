const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const { protect, restrictTo } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Keep blog media in the same backend/uploads directory served by server.js.
const uploadDir = path.resolve(__dirname, '..', '..', process.env.UPLOAD_PATH || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + unique + path.extname(file.originalname));
    }
});

const uploadBlogMedia = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) return cb(null, true);
        cb(new Error('Only image files allowed'), false);
    },
    limits: { fileSize: 52428800 }
}).fields([
    { name: 'featuredImage', maxCount: 1 },
    { name: 'blockImages', maxCount: 50 }
]);

router.get('/', blogController.getAllBlogs);
router.get('/:id', blogController.getBlogById);
router.post('/', protect, restrictTo('admin'), uploadBlogMedia, blogController.createBlog);
router.put('/:id', protect, restrictTo('admin'), uploadBlogMedia, blogController.updateBlog);
router.delete('/:id', protect, restrictTo('admin'), blogController.deleteBlog);

module.exports = router;
