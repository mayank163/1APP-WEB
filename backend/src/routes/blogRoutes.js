const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const { protect, checkPermission } = require('../middleware/auth');
const multer = require('multer');

const parseBlogMedia = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(null, true);
        cb(new Error('Only PNG, JPG and WebP images are allowed'), false);
    },
    limits: { fileSize: 5 * 1024 * 1024 }
}).fields([
    { name: 'featuredImage', maxCount: 1 },
    { name: 'blockImages', maxCount: 50 }
]);

const uploadBlogMedia = (req, res, next) => parseBlogMedia(req, res, err => {
    if (err) { err.statusCode = 400; if (err.code === 'LIMIT_FILE_SIZE') err.message = 'Images must be under 5MB'; return next(err); }
    next();
});

router.get('/admin/authors', protect, checkPermission('blogs', 'read'), blogController.getAuthors);
router.get('/admin', protect, checkPermission('blogs', 'read'), blogController.getAllBlogs);
router.get('/admin/:id', protect, checkPermission('blogs', 'read'), blogController.getBlogById);
router.get('/', blogController.getAllBlogs);
router.get('/:id', blogController.getBlogById);
router.post('/', protect, checkPermission('blogs', 'write'), uploadBlogMedia, blogController.createBlog);
router.put('/:id', protect, checkPermission('blogs', 'write'), uploadBlogMedia, blogController.updateBlog);
router.delete('/:id', protect, checkPermission('blogs', 'write'), blogController.deleteBlog);

module.exports = router;
