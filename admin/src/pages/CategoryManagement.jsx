import React, { useEffect, useRef, useState } from 'react';
import adminApi from '../services/adminApi';
import LoadingSpinner from '../components/LoadingSpinner';
import { FaPlus, FaEdit, FaTrash, FaFolder, FaImage } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { getImageUrl } from '../utils/helpers';

const CategoryManagement = () => {
    const [subcategories, setSubcategories] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [subcategoryName, setSubcategoryName] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [iconFile, setIconFile] = useState(null);
    const [iconPreview, setIconPreview] = useState(null);
    const [startingFromPrice, setStartingFromPrice] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('asc');
    const formRef = useRef(null);
    const tableRef = useRef(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [catRes, subRes] = await Promise.all([
                adminApi.getCategories(),
                adminApi.getSubCategories()
            ]);
            if (catRes.success) setCategories(catRes.data.categories);
            if (subRes.success) setSubcategories(subRes.data.subcategories);
        } catch {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleOpenCreate = () => {
        setEditingId(null);
        setSelectedCategoryId('');
        setSubcategoryName('');
        setImageFile(null);
        setImagePreview(null);
        setIconFile(null);
        setIconPreview(null);
        setStartingFromPrice('');
        setShowForm(true);
    };

    const handleOpenEdit = (sub) => {
        setEditingId(sub._id);
        setSelectedCategoryId(sub.category?._id || '');
        setSubcategoryName(sub.name);
        setImageFile(null);
        setImagePreview(sub.image ? getImageUrl(sub.image) : null);
        setIconFile(null);
        setIconPreview(sub.icon ? getImageUrl(sub.icon) : null);
        setStartingFromPrice(sub.startingFromPrice?.toString() || '');
        setShowForm(true);
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleIconChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setIconFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setIconPreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to permanently delete this subcategory?')) return;
        try {
            const res = await adminApi.deleteSubCategory(id);
            if (res.success) { toast.success('SubCategory deleted!'); fetchData(); }
        } catch { toast.error('Deletion failed'); }
    };

    const handleToggleStatus = async (id, isActive) => {
        try {
            const res = await adminApi.toggleSubCategoryStatus(id, isActive);
            if (res.success) {
                toast.success(`SubCategory marked ${isActive ? 'Active' : 'Inactive'}`);
                setSubcategories(prev => prev.map(s => s._id === id ? { ...s, isActive } : s));
            }
        } catch { toast.error('Status update failed'); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedCategoryId || !subcategoryName.trim()) {
            toast.error('Category and subcategory name are required!');
            return;
        }
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('name', subcategoryName);
            formData.append('categoryId', selectedCategoryId);
            if (startingFromPrice) formData.append('startingFromPrice', startingFromPrice);
            if (imageFile) formData.append('image', imageFile);
            if (iconFile) formData.append('icon', iconFile);

            let res;
            if (editingId) {
                res = await adminApi.updateSubCategory(editingId, formData);
                if (res.success) toast.success('SubCategory updated!');
            } else {
                res = await adminApi.createSubCategory(formData);
                if (res.success) toast.success('SubCategory created!');
            }
            setShowForm(false);
            fetchData();
            setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save subcategory');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredSubcategories = [...subcategories]
    .filter((sub) =>
        sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.category?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
        const first = a.name.toLowerCase();
        const second = b.name.toLowerCase();

        return sortOrder === 'asc'
            ? first.localeCompare(second)
            : second.localeCompare(first);
    });

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="fw-extrabold text-dark mb-1">Sub-Category Management</h1>
                    <p className="text-muted">Add subcategories of selected categories</p>
                </div>
                {!showForm && (
                    <button onClick={handleOpenCreate} className="btn btn-dark fw-bold d-flex align-items-center gap-2 px-4 shadow-sm">
                        <FaPlus /><span>Add Sub-Category</span>
                    </button>
                )}
            </div>

            {showForm && (
                <div ref={formRef} className="card border-0 shadow-sm rounded-3 bg-white p-4 mb-4">
                    <h5 className="fw-bold mb-4 border-bottom pb-2">
                        {editingId ? 'Edit Sub-Category' : 'Create New Sub-Category'}
                    </h5>
                    <form onSubmit={handleSubmit}>
                        <div className="row g-3 mb-4">
                            <div className="col-md-6">
                                <label className="form-label text-muted small fw-bold">Select Category *</label>
                                <select
                                    required
                                    className="form-select bg-light border-0"
                                    value={selectedCategoryId}
                                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                                >
                                    <option value="">Choose a category...</option>
                                    {categories.map(cat => (
                                        <option key={cat._id} value={cat._id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-md-6">
                                <label className="form-label text-muted small fw-bold">Sub-Category Name *</label>
                                <input
                                    type="text"
                                    required
                                    className="form-control bg-light border-0"
                                    placeholder="e.g., Cleaning, Wiring, Repair"
                                    value={subcategoryName}
                                    onChange={(e) => setSubcategoryName(e.target.value)}
                                />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label text-muted small fw-bold">Starting From Price ($)</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="form-control bg-light border-0"
                                    placeholder="e.g., 299"
                                    value={startingFromPrice}
                                    onChange={(e) => setStartingFromPrice(e.target.value)}
                                />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label text-muted small fw-bold">Upload Image</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="form-control bg-light border-0"
                                    onChange={handleImageChange}
                                />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label text-muted small fw-bold">Upload Icon</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="form-control bg-light border-0"
                                    onChange={handleIconChange}
                                />
                            </div>
                        </div>

                        <div className="d-flex gap-4 mb-4">
                            {imagePreview && (
                                <div>
                                    <label className="text-muted small fw-bold d-block mb-2">Image Preview:</label>
                                    <img src={imagePreview} alt="Preview" className="img-thumbnail" style={{ maxWidth: '150px' }} />
                                </div>
                            )}
                            {iconPreview && (
                                <div>
                                    <label className="text-muted small fw-bold d-block mb-2">Icon Preview:</label>
                                    <img src={iconPreview} alt="Icon Preview" className="img-thumbnail" style={{ maxWidth: '60px' }} />
                                </div>
                            )}
                        </div>

                        <div className="d-flex gap-2 justify-content-end">
                            <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline-secondary px-4 py-2">Cancel</button>
                            <button type="submit" disabled={submitting} className="btn btn-dark fw-bold px-4 py-2 shadow-sm">
                                {submitting ? 'Saving...' : 'Save Sub-Category'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div ref={tableRef} className="card border-0 shadow-sm rounded-3 bg-white p-4">

    <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">

        <input
            type="text"
            className="form-control"
            placeholder="Search category or sub-category..."
            style={{ maxWidth: "350px" }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
            className="form-select"
            style={{ width: "180px" }}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
        >
            <option value="asc">
                Ascending (A-Z)
            </option>

            <option value="desc">
                Descending (Z-A)
            </option>
        </select>

    </div>
                {loading ? <LoadingSpinner message="Loading sub-categories..." /> : (
                    <div className="table-responsive">
                        <table className="table table-hover align-middle">
                            <thead className="table-light border-0">
                                <tr>
                                    <th>Image</th>
                                    <th>Icon</th>
                                    <th>Category</th>
                                    <th>Sub-Category</th>
                                    <th>Starting Price</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSubcategories.map((sub) => (
                                    <tr key={sub._id}>
                                        <td>
                                            {sub.image ? (
                                                <img 
                                                    src={getImageUrl(sub.image)} 
                                                    alt={sub.name} 
                                                    className="img-thumbnail" 
                                                    style={{ maxWidth: '50px' }}
                                                    onError={(e) => { e.target.src = 'https://via.placeholder.com/50'; }}
                                                />
                                            ) : (
                                                <div className="bg-light text-muted d-flex align-items-center justify-content-center" style={{ width: '50px', height: '50px' }}>
                                                    <FaImage size={16} />
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            {sub.icon ? (
                                                <img
                                                    src={getImageUrl(sub.icon)}
                                                    alt={`${sub.name} icon`}
                                                    className="img-thumbnail"
                                                    style={{ maxWidth: '35px' }}
                                                    onError={(e) => { e.target.src = 'https://via.placeholder.com/35'; }}
                                                />
                                            ) : (
                                                <div className="bg-light text-muted d-flex align-items-center justify-content-center" style={{ width: '35px', height: '35px' }}>
                                                    <FaImage size={12} />
                                                </div>
                                            )}
                                        </td>
                                        <td className="fw-bold text-dark">
                                            <FaFolder className="text-primary me-2" />{sub.category?.name || '—'}
                                        </td>
                                        <td className="fw-semibold">{sub.name}</td>
                                        <td className="fw-bold text-primary">
                                            {sub.startingFromPrice ? `$${sub.startingFromPrice}` : '—'}
                                        </td>
                                        <td>
                                            <select
                                                className={`form-select form-select-sm border-0 fw-bold ${ sub.isActive ? 'text-success' : 'text-danger'}`}
                                                style={{ width: '110px', backgroundColor: sub.isActive ? '#d1f5e0' : '#fde8e8' }}
                                                value={sub.isActive ? 'active' : 'inactive'}
                                                onChange={(e) => handleToggleStatus(sub._id, e.target.value === 'active')}
                                            >
                                                <option value="active">Active</option>
                                                <option value="inactive">Inactive</option>
                                            </select>
                                        </td>
                                        <td>
                                            <div className="d-flex gap-1">
                                                <button onClick={() => handleOpenEdit(sub)} className="btn btn-sm btn-light border text-primary" title="Edit"><FaEdit /></button>
                                                <button onClick={() => handleDelete(sub._id)} className="btn btn-sm btn-light border text-danger" title="Delete"><FaTrash /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredSubcategories.length === 0 && (
                                    <tr><td colSpan="7" className="text-center py-5 text-muted">No sub-categories found. Create your first sub-category!</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CategoryManagement;
