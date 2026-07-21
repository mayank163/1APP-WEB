const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const { protect, restrictTo } = require('../middleware/auth');
const multer = require('multer');

const uploadBlogMedia = multer({
    storage: multer.memoryStorage(),
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
