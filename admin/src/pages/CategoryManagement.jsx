import React, { useEffect, useRef, useState } from 'react';
import CatalogManagementLayout, { loadCatalog } from '../components/CatalogManagementLayout';
import CatalogModal, { IconUpload, StatusChoices } from '../components/CatalogModal';
import adminApi from '../services/adminApi';
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
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState('active');
    const [submitting, setSubmitting] = useState(false);
    const tableRef = useRef(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [categoryItems, subcategoryItems] = await Promise.all([
                loadCatalog(adminApi.getCategories, 'categories'),
                loadCatalog(adminApi.getAdminSubCategories, 'subcategories')
            ]);
            const categoryOptions = new Map(categoryItems.map(item => [item._id, item]));
            subcategoryItems.forEach(item => {
                if (item.category?._id && !categoryOptions.has(item.category._id)) categoryOptions.set(item.category._id, item.category);
            });
            setCategories([...categoryOptions.values()]);
            setSubcategories(subcategoryItems);
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
        setDescription('');
        setStatus('draft');
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
        setDescription(sub.description || '');
        setStatus(sub.status || (sub.isActive ? 'active' : 'inactive'));
        setImageFile(null);
        setImagePreview(sub.image ? getImageUrl(sub.image) : null);
        setIconFile(null);
        setIconPreview(sub.icon ? getImageUrl(sub.icon) : null);
        setStartingFromPrice(sub.startingFromPrice?.toString() || '');
        setShowForm(true);
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
                setSubcategories(prev => prev.map(s => s._id === id ? { ...s, isActive, status: isActive ? 'active' : 'inactive' } : s));
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
            formData.append('description', description);
            formData.append('status', status);
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


    return (
        <CatalogManagementLayout kind="subcategories" items={subcategories} categories={categories} loading={loading}
            onCreate={handleOpenCreate} onEdit={handleOpenEdit} onDelete={handleDelete} onToggle={handleToggleStatus} showForm={showForm}>
            {showForm && <CatalogModal title={editingId ? 'Edit sub category' : 'Create sub category'} onClose={() => setShowForm(false)} busy={submitting}>
                <form onSubmit={handleSubmit}>
                    <IconUpload label={editingId ? 'Edit icon' : 'Icon'} onChange={handleIconChange} preview={iconPreview} />
                    <div className="catalog-modal-grid">
                        <label className="catalog-modal-field"><span>Sub category name</span><input autoFocus required placeholder="e.g. Smart Lighting" value={subcategoryName} onChange={event => setSubcategoryName(event.target.value)} /></label>
                        <label className="catalog-modal-field"><span>Category</span><select required value={selectedCategoryId} onChange={event => setSelectedCategoryId(event.target.value)}><option value="">Choose category</option>{categories.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
                    </div>
                    <label className="catalog-modal-field"><span>Description</span><textarea rows={2} placeholder="What does this sub category cover?" value={description} onChange={event => setDescription(event.target.value)} /></label>
                    <label className="catalog-modal-field"><span>Starting price (USD)</span><input type="number" min="0" step="0.01" value={startingFromPrice} onChange={event => setStartingFromPrice(event.target.value)} placeholder="0" /></label>
                    <IconUpload label="Image" onChange={handleImageChange} preview={imagePreview} />
                    <StatusChoices value={status} onChange={setStatus} />
                    <div className="catalog-modal-footer"><button type="button" disabled={submitting} className="catalog-modal-cancel" onClick={() => setShowForm(false)}>Cancel</button><button disabled={submitting} className="catalog-modal-save">{submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Create sub category'}</button></div>
                </form>
            </CatalogModal>}
            <div ref={tableRef} />
        </CatalogManagementLayout>
    );
};

export default CategoryManagement;
