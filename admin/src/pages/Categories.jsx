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
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);
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

    const handleDelete = (id) => {
        const category = categories.find(item => item._id === id);
        if (category) setDeleteTarget(category);
    };

    const confirmDelete = async () => {
        if (!deleteTarget || deleting) return;
        setDeleting(true);
        try {
            const res = await adminApi.deleteCategory(deleteTarget._id);
            if (!res.success) throw new Error(res.message || 'Deletion failed');
            setCategories(previous => previous.filter(item => item._id !== deleteTarget._id));
            setDeleteTarget(null);
            toast.success('Category deleted!');
        } catch (err) {
            if (err.response?.status === 409) {
                setInUse({ ...deleteTarget, ...err.response.data });
                setDeleteTarget(null);
            } else toast.error(err.response?.data?.message || err.message || 'Deletion failed');
        } finally {
            setDeleting(false);
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
            {deleteTarget && <CatalogModal title="Delete category?" busy={deleting} onClose={() => !deleting && setDeleteTarget(null)}>
                <p>Permanently delete "{deleteTarget.name}"? This cannot be undone.</p>
                <div className="catalog-modal-footer"><button type="button" className="catalog-modal-cancel" disabled={deleting} onClick={() => setDeleteTarget(null)}>Cancel</button><button type="button" className="catalog-modal-save" disabled={deleting} onClick={confirmDelete}>{deleting ? 'Deleting…' : 'Delete category'}</button></div>
            </CatalogModal>}
            {inUse && <CatalogModal alert title={<><FiAlertTriangle />Category in use</>} onClose={() => setInUse(null)}>
                <p>Can't delete "{inUse.name}" because it contains {inUse.serviceCount || 0} services and {inUse.subcategoryCount || 0} subcategories.<br />Move or delete them first.</p>
                <div className="catalog-modal-footer"><button className="catalog-modal-save" onClick={() => setInUse(null)}>Close</button></div>
            </CatalogModal>}
        </CatalogManagementLayout>
    );
};

export default Categories;
