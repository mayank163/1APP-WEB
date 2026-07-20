import React, { useEffect, useState } from 'react';
import adminApi from '../services/adminApi';
import LoadingSpinner from '../components/LoadingSpinner';
import { FaPlus, FaEdit, FaTrash, FaImage, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { getImageUrl } from '../utils/helpers';

const Categories = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [categoryName, setCategoryName] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('asc');

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getCategories();
            if (res.success) setCategories(res.data.categories);
        } catch {
            toast.error('Failed to load categories');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleOpenCreate = () => {
        setEditingId(null);
        setCategoryName('');
        setImageFile(null);
        setImagePreview(null);
        setShowForm(true);
    };

    const handleOpenEdit = (cat) => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setEditingId(cat._id);
        setCategoryName(cat.name);
        setImageFile(null);
        setImagePreview(cat.image ? getImageUrl(cat.image) : null);
        setShowForm(true);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this category?')) return;
        try {
            const res = await adminApi.deleteCategory(id);
            if (res.success) { toast.success('Category deleted!'); fetchData(); }
        } catch { toast.error('Deletion failed'); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!categoryName.trim()) {
            toast.error('Category name is required!');
            return;
        }
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('name', categoryName);
            if (imageFile) {
                formData.append('image', imageFile);
            }

            let res;
            if (editingId) {
                res = await adminApi.updateCategory(editingId, formData);
                if (res.success) toast.success('Category updated!');
            } else {
                res = await adminApi.createCategory(formData);
                if (res.success) toast.success('Category created!');
            }
            setShowForm(false);
            fetchData();
            if (editingId) window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save category');
        } finally {
            setSubmitting(false);
        }
    };

    const filteredcategories = [...categories]
    .filter((cat) =>
        cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cat.category?.name?.toLowerCase().includes(searchTerm.toLowerCase())
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
                    <h1 className="fw-extrabold text-dark mb-1">Category Management</h1>
                    <p className="text-muted">Add and manage service categories with images</p>
                </div>
                {!showForm && (
                    <button onClick={handleOpenCreate} className="btn btn-dark fw-bold d-flex align-items-center gap-2 px-4 shadow-sm">
                        <FaPlus /><span>Add Category</span>
                    </button>
                )}
            </div>

            {showForm && (
                <div className="card border-0 shadow-sm rounded-3 bg-white p-4 mb-4">
                    <h5 className="fw-bold mb-4 border-bottom pb-2">
                        {editingId ? 'Edit Category' : 'Create New Category'}
                    </h5>
                    <form onSubmit={handleSubmit}>
                        <div className="row g-3 mb-4">
                            <div className="col-md-6">
                                <label className="form-label text-muted small fw-bold">Category Name *</label>
                                <input
                                    type="text"
                                    required
                                    className="form-control bg-light border-0"
                                    placeholder="e.g., Home Services, IT Support"
                                    value={categoryName}
                                    onChange={(e) => setCategoryName(e.target.value)}
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
                        </div>

                        {imagePreview && (
                            <div className="mb-4">
                                <label className="text-muted small fw-bold d-block mb-2">Image Preview:</label>
                                <img src={imagePreview} alt="Preview" className="img-thumbnail" style={{ maxWidth: '200px' }} />
                            </div>
                        )}

                        <div className="d-flex gap-2 justify-content-end">
                            <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline-secondary px-4 py-2">Cancel</button>
                            <button type="submit" disabled={submitting} className="btn btn-dark fw-bold px-4 py-2 shadow-sm">
                                {submitting ? 'Saving...' : 'Save Category'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card border-0 shadow-sm rounded-3 bg-white p-4">

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
                {loading ? <LoadingSpinner message="Loading categories..." /> : (
                    <div className="table-responsive">
                        <table className="table table-hover align-middle">
                            <thead className="table-light border-0">
                                <tr>
                                    <th>Image</th>
                                    <th>Category Name</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredcategories.map((cat) => (
                                
                                    <tr key={cat._id}>
                                        <td>
                                            
                                            {cat.image ? (
                                                <img 
                                                    src={getImageUrl(cat.image)}
                                                    alt={cat.name} 
                                                    className="img-thumbnail" 
                                                    style={{ maxWidth: '60px' }}
                                                    onError={(e) => { e.target.src = 'https://via.placeholder.com/60'; }}
                                                />
                                            ) : (
                                                <div className="bg-light text-muted d-flex align-items-center justify-content-center" style={{ width: '60px', height: '60px' }}>
                                                    <FaImage size={20} />
                                                </div>
                                            )}
                                        </td>
                                        <td className="fw-bold text-dark">{cat.name}</td>
                                        <td>
                                            {cat.isActive ? (
                                                <span className="text-success d-flex align-items-center gap-1 small fw-bold"><FaCheckCircle /><span>Active</span></span>
                                            ) : (
                                                <span className="text-danger d-flex align-items-center gap-1 small fw-bold"><FaTimesCircle /><span>Inactive</span></span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="d-flex gap-1">
                                                <button onClick={() => handleOpenEdit(cat)} className="btn btn-sm btn-light border text-primary" title="Edit"><FaEdit /></button>
                                                <button onClick={() => handleDelete(cat._id)} className="btn btn-sm btn-light border text-danger" title="Delete"><FaTrash /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredcategories.length === 0 && (
                                    <tr><td colSpan="4" className="text-center py-5 text-muted">No categories found. Create your first category!</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Categories;
