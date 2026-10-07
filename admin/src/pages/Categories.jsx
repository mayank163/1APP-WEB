import React, { useEffect, useState } from 'react';
import CatalogManagementLayout, { loadCatalog } from '../components/CatalogManagementLayout';
import CatalogModal, { IconUpload, StatusChoices } from '../components/CatalogModal';
import { FiAlertTriangle } from 'react-icons/fi';
import adminApi from '../services/adminApi';
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
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState('active');
    const [inUse, setInUse] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            setCategories(await loadCatalog(adminApi.getAdminCategories, 'categories'));
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
        setDescription('');
        setStatus('draft');
        setImageFile(null);
        setImagePreview(null);
        setShowForm(true);
    };

    const handleOpenEdit = (cat) => {
        setEditingId(cat._id);
        setCategoryName(cat.name);
        setDescription(cat.description || '');
        setStatus(cat.status || (cat.isActive ? 'active' : 'inactive'));
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
        const category = categories.find(item => item._id === id);
        if (category?.serviceCount > 0) { setInUse(category); return; }
        if (!window.confirm('Delete this category?')) return;
        try {
            const res = await adminApi.deleteCategory(id);
            if (res.success) { toast.success('Category deleted!'); fetchData(); }
        } catch (err) {
            if (err.response?.status === 409) setInUse({ ...category, serviceCount: err.response.data.serviceCount });
            else toast.error('Deletion failed');
        }
    };

    const handleToggleStatus = async (id, isActive) => {
        try {
            const data = new FormData();
            data.append('isActive', String(isActive));
            const res = await adminApi.updateCategory(id, data);
            if (!res.success) throw new Error('Status update failed');
            setCategories(previous => previous.map(item => item._id === id ? { ...item, isActive, status: isActive ? 'active' : 'inactive' } : item));
            toast.success(`Category marked ${isActive ? 'Active' : 'Inactive'}`);
        } catch { toast.error('Status update failed'); }
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
            formData.append('description', description);
            formData.append('status', status);
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
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save category');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <CatalogManagementLayout kind="categories" items={categories} categories={categories} loading={loading}
            onCreate={handleOpenCreate} onEdit={handleOpenEdit} onDelete={handleDelete} onToggle={handleToggleStatus} showForm={showForm}>
            {showForm && <CatalogModal title={editingId ? 'Edit category' : 'Create category'} onClose={() => setShowForm(false)} busy={submitting}>
                <form onSubmit={handleSubmit}>
                    <IconUpload label={editingId ? 'Edit icon' : 'Icon'} onChange={handleImageChange} preview={imagePreview} />
                    <label className="catalog-modal-field"><span>Category name</span><input autoFocus required placeholder="e.g. Smart Home" value={categoryName} onChange={event => setCategoryName(event.target.value)} /></label>
                    <label className="catalog-modal-field"><span>Description</span><textarea rows={2} placeholder="What does this category cover?" value={description} onChange={event => setDescription(event.target.value)} /></label>
                    <StatusChoices value={status} onChange={setStatus} />
                    <div className="catalog-modal-footer"><button type="button" disabled={submitting} className="catalog-modal-cancel" onClick={() => setShowForm(false)}>Cancel</button><button disabled={submitting} className="catalog-modal-save">{submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Create category'}</button></div>
                </form>
            </CatalogModal>}
            {inUse && <CatalogModal alert title={<><FiAlertTriangle />Category in use</>} onClose={() => setInUse(null)}>
                <p>Can't delete "{inUse.name}" — {inUse.serviceCount} {inUse.serviceCount === 1 ? 'service still belongs' : 'services still belong'} to it.<br />Move or delete those services first.</p>
                <div className="catalog-modal-footer"><button className="catalog-modal-save" onClick={() => setInUse(null)}>Close</button></div>
            </CatalogModal>}
        </CatalogManagementLayout>
    );
};

export default Categories;
