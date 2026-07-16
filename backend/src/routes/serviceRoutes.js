const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const categoryController = require('../controllers/categoryController');
const reviewController = require('../controllers/reviewController');
const { protect, restrictTo } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { uploadServiceMedia, uploadCategoryMedia } = require('../middleware/upload');

// ─── CATEGORY ─────────────────────────────────────────────────────────────────
router.get('/categories', categoryController.getAllCategories);
router.get('/categories/subcategories',categoryController.getCategoriesWithRecentSubCategories);
router.post('/categories', protect, restrictTo('admin'), upload.single('image'), categoryController.createCategory);
router.put('/categories/:id', protect, restrictTo('admin'), upload.single('image'), categoryController.updateCategory);
router.delete('/categories/:id', protect, restrictTo('admin'), categoryController.deleteCategory);

// ─── SUBCATEGORY ──────────────────────────────────────────────────────────────
router.get('/subcategories', categoryController.getAllSubCategories);
router.get('/categories/:id/subcategories', categoryController.getSubCategoriesByCategory);
router.get('/subcategories/:id/services', categoryController.getServicesBySubCategory);
router.get('/subcategory/:subcategory', serviceController.getServicesBySubcategory);
router.post('/subcategories', protect, restrictTo('admin'), uploadCategoryMedia, categoryController.createSubCategory);
router.put('/subcategories/:id', protect, restrictTo('admin'), uploadCategoryMedia, categoryController.updateSubCategory);
router.delete('/subcategories/:id', protect, restrictTo('admin'), categoryController.deleteSubCategory);
router.patch('/subcategories/:id/status', protect, restrictTo('admin'), categoryController.toggleSubCategoryStatus);

// ─── SERVICES ─────────────────────────────────────────────────────────────────
router.get('/featured', serviceController.getFeaturedServices);
router.get('/hierarchy', serviceController.getServiceHierarchy);
router.get('/', serviceController.getAllServices);
router.get('/:id', serviceController.getServiceById);
router.post('/', protect, restrictTo('admin'), uploadServiceMedia, serviceController.createService);
router.put('/:id', protect, restrictTo('admin'), uploadServiceMedia, serviceController.updateService);
router.delete('/:id', protect, restrictTo('admin'), serviceController.deleteService);

// ─── REVIEWS (nested under service) ──────────────────────────────────────────
router.get('/:serviceId/reviews', reviewController.getServiceReviews);
router.get('/:serviceId/reviews/can-review', protect, reviewController.checkCanReview);
router.post('/:serviceId/reviews', protect, reviewController.createReview);

module.exports = router;
