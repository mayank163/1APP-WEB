import React, { useEffect, useState } from 'react';
import adminApi from '../services/adminApi';
import { toast } from 'react-toastify';
import { FaPlus, FaEdit, FaTrash, FaImage, FaArrowUp, FaArrowDown, FaEye, FaSave, FaTimes } from 'react-icons/fa';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/BlogManagement.css';
import { getImageUrl } from '../utils/helpers';

const emptyBlock = () => ({ title: '', text: '', imageFile: null, imagePreview: '', image: null });

const BlogManagement = () => {
    const [blogs, setBlogs] = useState([]);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [filteredSubcategories, setFilteredSubcategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [description, setDescription] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [subcategoryId, setSubcategoryId] = useState('');
    const [isPublished, setIsPublished] = useState(true);
    const [featuredImageFile, setFeaturedImageFile] = useState(null);
    const [featuredImagePreview, setFeaturedImagePreview] = useState('');
    const [blocks, setBlocks] = useState([emptyBlock()]);
    const [metaTitle, setMetaTitle] = useState('');
    const [metaDescription, setMetaDescription] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [blogRes, catRes, subRes] = await Promise.all([
                adminApi.getBlogs(),
                adminApi.getCategories(),
                adminApi.getSubCategories()
            ]);
            if (blogRes.success) setBlogs(blogRes.data.blogs);
            if (catRes.success) setCategories(catRes.data.categories);
            if (subRes.success) setSubcategories(subRes.data.subcategories);
        } catch (err) {
            toast.error('Failed to load data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    // Filter subcategories when category changes
    useEffect(() => {
        if (categoryId) {
            setFilteredSubcategories(subcategories.filter(s => s.category?._id === categoryId));
            // Don't reset subcategoryId here — edit handler sets it manually after setting categoryId
        } else {
            setFilteredSubcategories([]);
        }
    }, [categoryId, subcategories]);

    const resetForm = () => {
        setEditingId(null);
        setTitle('');
        setSubtitle('');
        setDescription('');
        setCategoryId('');
        setSubcategoryId('');
        setIsPublished(true);
        setFeaturedImageFile(null);
        setFeaturedImagePreview('');
        setBlocks([emptyBlock()]);
        setMetaTitle('');
        setMetaDescription('');
    };

    const handleOpenCreate = () => { 
        resetForm(); 
        setShowForm(true); 
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleOpenEdit = (blog) => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setEditingId(blog._id);
        setTitle(blog.title);
        setSubtitle(blog.subtitle || '');
        setDescription(blog.description);
        
        // Set category first, then subcategory
        const catId = blog.subcategory?.category?._id || '';
        setCategoryId(catId);
        setFilteredSubcategories(subcategories.filter(s => s.category?._id === catId));
        setSubcategoryId(blog.subcategory?._id || '');
        
        setIsPublished(blog.isPublished);
        setFeaturedImageFile(null);
        setFeaturedImagePreview(blog.featuredImage ? getImageUrl(blog.featuredImage) : '');
        setBlocks(
            blog.contentBlocks?.length
                ? blog.contentBlocks.map(b => ({
                    title: b.title || '',
                    text: b.text || '',
                    imageFile: null,
                    imagePreview: b.image ? getImageUrl(b.image) : '',
                    image: b.image || null
                }))
                : [emptyBlock()]
        );
        setMetaTitle(blog.metaTitle || '');
        setMetaDescription(blog.metaDescription || '');
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this blog? This action cannot be undone.')) return;
        try {
            const res = await adminApi.deleteBlog(id);
            if (res.success) { 
                toast.success('Blog deleted successfully'); 
                fetchData(); 
            }
        } catch (err) { 
            toast.error(err.response?.data?.message || 'Failed to delete blog'); 
        }
    };

    // Block handlers
    const handleBlockTextChange = (i, val) => {
        setBlocks(prev => prev.map((b, idx) => idx === i ? { ...b, text: val } : b));
    };

    const handleBlockTitleChange = (i, val) => {
        setBlocks(prev => prev.map((b, idx) => idx === i ? { ...b, title: val } : b));
    };

    const handleBlockImageChange = (i, file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size should be less than 5MB');
            return;
        }
        const preview = URL.createObjectURL(file);
        setBlocks(prev => prev.map((b, idx) => idx === i ? { ...b, imageFile: file, imagePreview: preview } : b));
    };

    const handleRemoveBlockImage = (i) => {
        setBlocks(prev => prev.map((b, idx) => idx === i ? { ...b, imageFile: null, imagePreview: '', image: null } : b));
    };

    const handleAddBlock = () => setBlocks(prev => [...prev, emptyBlock()]);

    const handleRemoveBlock = (i) => {
        if (blocks.length === 1) {
            toast.warning('At least one content block is required');
            return;
        }
        setBlocks(prev => prev.filter((_, idx) => idx !== i));
    };

    const handleMoveBlock = (i, dir) => {
        const newBlocks = [...blocks];
        const target = i + dir;
        if (target < 0 || target >= newBlocks.length) return;
        [newBlocks[i], newBlocks[target]] = [newBlocks[target], newBlocks[i]];
        setBlocks(newBlocks);
    };

    const handleFeaturedImageChange = (file) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image size should be less than 5MB');
            return;
        }
        setFeaturedImageFile(file);
        setFeaturedImagePreview(URL.createObjectURL(file));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation
        if (!title.trim()) {
            toast.error('Please enter blog title');
            return;
        }
        if (!description.trim()) {
            toast.error('Please enter blog description');
            return;
        }
        if (!categoryId) {
            toast.error('Please select a category');
            return;
        }
        if (!subcategoryId) {
            toast.error('Please select a subcategory');
            return;
        }
        
        // Check if at least one block has content
        const hasContent = blocks.some(b => b.text.trim() || b.imageFile || b.image);
        if (!hasContent) {
            toast.error('Please add at least one content block with text or image');
            return;
        }

        setSubmitting(true);
        try {
            const fd = new FormData();
            fd.append('title', title.trim());
            fd.append('subtitle', subtitle.trim());
            fd.append('description', description.trim());
            fd.append('subcategory', subcategoryId);
            fd.append('isPublished', isPublished);
            fd.append('metaTitle', metaTitle.trim());
            fd.append('metaDescription', metaDescription.trim());

            if (featuredImageFile) {
                fd.append('featuredImage', featuredImageFile);
            }

            // Serialize blocks metadata (preserve existing image filenames for blocks without new file)
            const blocksMeta = blocks.map((b, i) => ({
                title: b.title.trim(),
                text: b.text.trim(),
                order: i,
                image: b.imageFile ? null : (b.image || null)
            }));
            fd.append('contentBlocks', JSON.stringify(blocksMeta));

            // Append block image files in order
            blocks.forEach((b) => {
                if (b.imageFile) {
                    fd.append('blockImages', b.imageFile);
                }
            });

            let res;
            if (editingId) {
                res = await adminApi.updateBlog(editingId, fd);
                if (res.success) toast.success('Blog updated successfully!');
            } else {
                res = await adminApi.createBlog(fd);
                if (res.success) toast.success('Blog created successfully!');
            }
            
            setShowForm(false);
            resetForm();
            fetchData();
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.message || 'Failed to save blog');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="blog-management">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="fw-bold text-dark mb-1">Blog Management</h1>
                    <p className="text-muted mb-0">Create and manage blog posts with rich content blocks</p>
                </div>
                {!showForm && (
                    <button 
                        onClick={handleOpenCreate} 
                        className="btn btn-dark fw-bold d-flex align-items-center gap-2 px-4"
                    >
                        <FaPlus /><span>Create New Blog</span>
                    </button>
                )}
            </div>

            {showForm && (
                <div className="card border-0 shadow-sm rounded-3 bg-white p-4 mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                        <h5 className="fw-bold mb-0">
                            {editingId ? '✏️ Edit Blog Post' : '📝 Create New Blog Post'}
                        </h5>
                        <button 
                            type="button" 
                            onClick={() => { setShowForm(false); resetForm(); }} 
                            className="btn btn-outline-secondary btn-sm"
                        >
                            <FaTimes className="me-1" /> Cancel
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Basic Info Section */}
                        <div className="mb-4">
                            <h6 className="fw-bold text-secondary mb-3">
                                <span className="badge bg-dark me-2">1</span>Basic Information
                            </h6>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label text-muted small fw-bold">
                                        Blog Title <span className="text-danger">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="form-control form-control-lg bg-light border-0"
                                        placeholder="Enter an engaging blog title..."
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        maxLength={200}
                                    />
                                    <div className="text-muted small mt-1">{title.length}/200 characters</div>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label text-muted small fw-bold">
                                        Subtitle <span className="text-muted fw-normal">(Optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control form-control-lg bg-light border-0"
                                        placeholder="A short supporting line under the title..."
                                        value={subtitle}
                                        onChange={e => setSubtitle(e.target.value)}
                                        maxLength={300}
                                    />
                                    <div className="text-muted small mt-1">{subtitle.length}/300 characters</div>
                                </div>
                                <div className="col-md-3">
                                    <label className="form-label text-muted small fw-bold">
                                        Category <span className="text-danger">*</span>
                                    </label>
                                    <select
                                        required
                                        className="form-select form-select-lg bg-light border-0"
                                        value={categoryId}
                                        onChange={e => {
                                            setCategoryId(e.target.value);
                                            setSubcategoryId('');
                                        }}
                                    >
                                        <option value="">Select category...</option>
                                        {categories.map(cat => (
                                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-3">
                                    <label className="form-label text-muted small fw-bold">
                                        Subcategory <span className="text-danger">*</span>
                                    </label>
                                    <select
                                        required
                                        className="form-select form-select-lg bg-light border-0"
                                        value={subcategoryId}
                                        onChange={e => setSubcategoryId(e.target.value)}
                                        disabled={!categoryId}
                                    >
                                        <option value="">Select subcategory...</option>
                                        {filteredSubcategories.map(s => (
                                            <option key={s._id} value={s._id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label text-muted small fw-bold">
                                        Short Description <span className="text-danger">*</span>
                                    </label>
                                    <textarea
                                        required
                                        rows="3"
                                        className="form-control bg-light border-0"
                                        placeholder="Write a compelling description that summarizes your blog post..."
                                        value={description}
                                        onChange={e => setDescription(e.target.value)}
                                        maxLength={500}
                                    />
                                    <div className="text-muted small mt-1">{description.length}/500 characters</div>
                                </div>
                            </div>
                        </div>

                        {/* Featured Image Section */}
                        <div className="mb-4">
                            <h6 className="fw-bold text-secondary mb-3">
                                <span className="badge bg-dark me-2">2</span>Featured Image
                            </h6>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label text-muted small fw-bold">
                                        Upload Featured Image (Optional)
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="form-control bg-light border-0"
                                        onChange={e => handleFeaturedImageChange(e.target.files[0])}
                                    />
                                    <div className="text-muted small mt-1">
                                        Recommended size: 1200x630px • Max 5MB
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    {featuredImagePreview && (
                                        <div className="position-relative d-inline-block">
                                            <img 
                                                src={featuredImagePreview} 
                                                alt="featured" 
                                                className="rounded border" 
                                                style={{ maxHeight: 150, maxWidth: '100%', objectFit: 'cover' }} 
                                            />
                                            <button
                                                type="button"
                                                className="btn btn-danger btn-sm position-absolute top-0 end-0 m-2"
                                                onClick={() => {
                                                    setFeaturedImageFile(null);
                                                    setFeaturedImagePreview('');
                                                }}
                                            >
                                                <FaTimes />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Content Blocks Section */}
                        <div className="mb-4">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h6 className="fw-bold text-secondary mb-0">
                                    <span className="badge bg-dark me-2">3</span>
                                    Content Blocks ({blocks.length})
                                </h6>
                                <button 
                                    type="button" 
                                    onClick={handleAddBlock} 
                                    className="btn btn-sm btn-dark d-flex align-items-center gap-1"
                                >
                                    <FaPlus size={12} /> Add Content Block
                                </button>
                            </div>

                            <div className="alert alert-info py-2 px-3 small mb-3">
                                <strong>💡 Tip:</strong> Each content block can contain an image and text. Add multiple blocks to create rich, engaging blog posts with alternating images and content.
                            </div>

                            <div className="content-blocks-container">
                                {blocks.map((block, i) => (
                                    <div 
                                        key={i} 
                                        className="card border-0 shadow-sm rounded-3 p-4 mb-3 bg-white"
                                        style={{ borderLeft: '4px solid #000' }}
                                    >
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <div className="d-flex align-items-center gap-2">
                                                <span className="badge bg-dark fs-6">Block {i + 1}</span>
                                                <span className="text-muted small">
                                                    {block.text.length > 0 && `${block.text.length} characters`}
                                                    {block.text.length > 0 && (block.imageFile || block.image) && ' • '}
                                                    {(block.imageFile || block.image) && '📷 Image attached'}
                                                </span>
                                            </div>
                                            <div className="d-flex gap-2">
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleMoveBlock(i, -1)} 
                                                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" 
                                                    disabled={i === 0}
                                                    title="Move up"
                                                >
                                                    <FaArrowUp size={12} />
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleMoveBlock(i, 1)} 
                                                    className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" 
                                                    disabled={i === blocks.length - 1}
                                                    title="Move down"
                                                >
                                                    <FaArrowDown size={12} />
                                                </button>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveBlock(i)} 
                                                    className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1" 
                                                    disabled={blocks.length === 1}
                                                    title="Remove block"
                                                >
                                                    <FaTrash size={12} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Block Title */}
                                        <div className="mb-3">
                                            <label className="form-label text-muted small fw-bold">
                                                Block Title <span className="text-muted fw-normal">(Optional)</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="form-control bg-light border-0"
                                                placeholder="e.g. Why This Matters, Step 1: Preparation..."
                                                value={block.title}
                                                onChange={e => handleBlockTitleChange(i, e.target.value)}
                                                maxLength={150}
                                            />
                                            <div className="text-muted small mt-1">{block.title.length}/150 characters</div>
                                        </div>

                                        <div className="row g-3">
                                            {/* Image Upload Column */}
                                            <div className="col-md-5">
                                                <label className="form-label text-muted small fw-bold">
                                                    <FaImage className="me-1" />Block Image (Optional)
                                                </label>
                                                <div className="border border-2 border-dashed rounded-3 p-3 text-center bg-light">
                                                    {block.imagePreview ? (
                                                        <div className="position-relative d-inline-block">
                                                            <img 
                                                                src={block.imagePreview} 
                                                                alt={`block-${i}`} 
                                                                className="rounded w-100" 
                                                                style={{ maxHeight: 200, objectFit: 'cover' }} 
                                                            />
                                                            <button
                                                                type="button"
                                                                className="btn btn-danger btn-sm position-absolute top-0 end-0 m-2"
                                                                onClick={() => handleRemoveBlockImage(i)}
                                                            >
                                                                <FaTimes />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="py-4">
                                                            <FaImage size={32} className="text-muted mb-2" />
                                                            <p className="text-muted small mb-2">No image uploaded</p>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="form-control form-control-sm bg-white"
                                                                onChange={e => handleBlockImageChange(i, e.target.files[0])}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                {!block.imagePreview && (
                                                    <div className="text-muted small mt-1">
                                                        Max 5MB • JPG, PNG, GIF
                                                    </div>
                                                )}
                                            </div>

                                            {/* Content Column */}
                                            <div className="col-md-7">
                                                <label className="form-label text-muted small fw-bold">
                                                    Block Content
                                                </label>
                                                <textarea
                                                    rows="9"
                                                    className="form-control bg-light border-0"
                                                    placeholder="Write your content here... You can describe, explain, or provide details related to the image."
                                                    value={block.text}
                                                    onChange={e => handleBlockTextChange(i, e.target.value)}
                                                    style={{ resize: 'vertical' }}
                                                />
                                                <div className="text-muted small mt-1">
                                                    {block.text.length} characters
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button 
                                type="button" 
                                onClick={handleAddBlock} 
                                className="btn btn-outline-dark btn-sm w-100 py-2 fw-bold"
                            >
                                <FaPlus className="me-2" /> Add Another Content Block
                            </button>
                        </div>

                        {/* SEO / Meta Section */}
                        <div className="mb-4">
                            <h6 className="fw-bold text-secondary mb-3">
                                <span className="badge bg-dark me-2">4</span>SEO &amp; Meta
                            </h6>
                            <div className="alert alert-light border py-2 px-3 small mb-3">
                                🔍 These fields control how the blog appears in search engine results. Leave blank to auto-use the title and description.
                            </div>
                            <div className="row g-3">
                                <div className="col-12">
                                    <label className="form-label text-muted small fw-bold">Meta Title</label>
                                    <input
                                        type="text"
                                        className="form-control bg-light border-0"
                                        placeholder="SEO title shown in search results (50–60 chars recommended)..."
                                        value={metaTitle}
                                        onChange={e => setMetaTitle(e.target.value)}
                                        maxLength={160}
                                    />
                                    <div className={`small mt-1 ${metaTitle.length > 60 ? 'text-warning' : 'text-muted'}`}>
                                        {metaTitle.length}/160 · Ideal: 50–60
                                    </div>
                                </div>
                                <div className="col-12">
                                    <label className="form-label text-muted small fw-bold">Meta Description</label>
                                    <textarea
                                        rows="2"
                                        className="form-control bg-light border-0"
                                        placeholder="Brief summary shown under the title in search results (120–160 chars recommended)..."
                                        value={metaDescription}
                                        onChange={e => setMetaDescription(e.target.value)}
                                        maxLength={320}
                                    />
                                    <div className={`small mt-1 ${metaDescription.length > 160 ? 'text-warning' : 'text-muted'}`}>
                                        {metaDescription.length}/320 · Ideal: 120–160
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Publishing Options */}
                        <div className="mb-4">
                            <h6 className="fw-bold text-secondary mb-3">
                                <span className="badge bg-dark me-2">5</span>Publishing Options
                            </h6>
                            <div className="form-check form-switch">
                                <input
                                    type="checkbox"
                                    className="form-check-input"
                                    id="isPublished"
                                    checked={isPublished}
                                    onChange={e => setIsPublished(e.target.checked)}
                                    style={{ width: '3rem', height: '1.5rem' }}
                                />
                                <label className="form-check-label fw-semibold ms-2" htmlFor="isPublished">
                                    {isPublished ? '✅ Publish Immediately' : '📝 Save as Draft'}
                                </label>
                            </div>
                            <div className="text-muted small mt-2">
                                {isPublished 
                                    ? 'This blog will be visible to all users immediately after saving.' 
                                    : 'This blog will be saved as a draft and won\'t be visible to users until published.'}
                            </div>
                        </div>

                        {/* Form Actions */}
                        <div className="d-flex gap-3 justify-content-end pt-3 border-top">
                            <button 
                                type="button" 
                                onClick={() => { setShowForm(false); resetForm(); }} 
                                className="btn btn-outline-secondary px-4 py-2"
                                disabled={submitting}
                            >
                                <FaTimes className="me-2" />Cancel
                            </button>
                            <button 
                                type="submit" 
                                disabled={submitting} 
                                className="btn btn-dark fw-bold px-5 py-2"
                            >
                                {submitting ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <FaSave className="me-2" />
                                        {editingId ? 'Update Blog' : 'Create Blog'}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Blog List */}
            <div className="card border-0 shadow-sm rounded-3 bg-white p-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-bold mb-0">Published Blogs ({blogs.length})</h6>
                    <div className="text-muted small">
                        {blogs.filter(b => b.isPublished).length} Published • {blogs.filter(b => !b.isPublished).length} Drafts
                    </div>
                </div>
                
                {loading ? (
                    <LoadingSpinner message="Loading blogs..." />
                ) : (
                    <div className="table-responsive">
                        <table className="table table-hover align-middle">
                            <thead className="table-light">
                                <tr>
                                    <th style={{ width: '80px' }}>Featured</th>
                                    <th>Title & Description</th>
                                    <th style={{ width: '130px' }}>Category</th>
                                    <th style={{ width: '130px' }}>Subcategory</th>
                                    <th style={{ width: '80px' }} className="text-center">Blocks</th>
                                    <th style={{ width: '100px' }}>Status</th>
                                    <th style={{ width: '120px' }}>Created</th>
                                    <th style={{ width: '100px' }} className="text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {blogs.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="text-center py-5">
                                            <div className="text-muted">
                                                <FaPlus size={32} className="mb-3 opacity-50" />
                                                <p className="mb-2">No blogs yet</p>
                                                <p className="small">Create your first blog post to get started!</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    blogs.map(blog => (
                                        <tr key={blog._id}>
                                            <td>
                                                {blog.featuredImage ? (
                                                    <img 
                                                        src={getImageUrl(blog.featuredImage)} 
                                                        alt="featured" 
                                                        className="rounded"
                                                        style={{ 
                                                            width: 60, 
                                                            height: 45, 
                                                            objectFit: 'cover',
                                                            border: '2px solid #dee2e6'
                                                        }} 
                                                    />
                                                ) : (
                                                    <div 
                                                        className="rounded bg-light d-flex align-items-center justify-content-center"
                                                        style={{ width: 60, height: 45 }}
                                                    >
                                                        <FaImage className="text-muted" />
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <div className="fw-semibold text-dark mb-1">{blog.title}</div>
                                                <div 
                                                    className="text-muted small" 
                                                    style={{ 
                                                        maxWidth: 280, 
                                                        overflow: 'hidden', 
                                                        textOverflow: 'ellipsis', 
                                                        whiteSpace: 'nowrap' 
                                                    }}
                                                >
                                                    {blog.description}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="fw-semibold text-dark small">
                                                    {blog.subcategory?.category?.name || '—'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="badge bg-light text-dark border">
                                                    {blog.subcategory?.name || '—'}
                                                </span>
                                            </td>
                                            <td className="text-center">
                                                <span className="badge bg-secondary">
                                                    {blog.contentBlocks?.length || 0}
                                                </span>
                                            </td>
                                            <td>
                                                {blog.isPublished ? (
                                                    <span className="badge bg-success">
                                                        <FaEye className="me-1" size={10} />
                                                        Published
                                                    </span>
                                                ) : (
                                                    <span className="badge bg-warning text-dark">
                                                        📝 Draft
                                                    </span>
                                                )}
                                            </td>
                                            <td className="text-muted small">
                                                {new Date(blog.createdAt).toLocaleDateString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                            </td>
                                            <td>
                                                <div className="d-flex gap-2 justify-content-center">
                                                    <button 
                                                        onClick={() => handleOpenEdit(blog)} 
                                                        className="btn btn-sm btn-light border text-primary"
                                                        title="Edit blog"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(blog._id)} 
                                                        className="btn btn-sm btn-light border text-danger"
                                                        title="Delete blog"
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BlogManagement;
