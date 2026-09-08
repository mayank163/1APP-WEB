import React, { useEffect, useRef, useState } from 'react';
import adminApi from '../services/adminApi';
import { FaPlus, FaEdit, FaTrash, FaWrench, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';

const EMPTY_FORM = { name: '', description: '' };

const ServiceTypeManagement = () => {
    const [serviceTypes, setServiceTypes] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [showForm, setShowForm]         = useState(false);
    const [editingId, setEditingId]       = useState(null);
    const [form, setForm]                 = useState(EMPTY_FORM);
    const [saving, setSaving]             = useState(false);
    const [searchTerm, setSearchTerm]     = useState('');
    const [sortOrder, setSortOrder]       = useState('asc');
    const formRef                         = useRef(null);

    /* ─── fetch ────────────────────────────────────────────────────── */
    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getServiceTypes();
            if (res.success) setServiceTypes(res.data.serviceTypes);
        } catch { toast.error('Failed to load service types'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    /* ─── form helpers ─────────────────────────────────────────────── */
    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setShowForm(true);
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    const openEdit = (st) => {
        setEditingId(st._id);
        setForm({ name: st.name, description: st.description || '' });
        setShowForm(true);
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    /* ─── CRUD ─────────────────────────────────────────────────────── */
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error('Name is required'); return; }
        setSaving(true);
        try {
            if (editingId) {
                const res = await adminApi.updateServiceType(editingId, form);
                if (res.success) toast.success('Service type updated');
            } else {
                const res = await adminApi.createServiceType(form);
                if (res.success) toast.success('Service type created');
            }
            setShowForm(false);
            fetchData();
        } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this service type?')) return;
        try {
            await adminApi.deleteServiceType(id);
            toast.success('Service type deleted');
            fetchData();
        } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
    };

    const handleToggleStatus = async (st) => {
        try {
            await adminApi.toggleServiceTypeStatus(st._id, !st.isActive);
            setServiceTypes(prev =>
                prev.map(s => s._id === st._id ? { ...s, isActive: !s.isActive } : s)
            );
            toast.success(`Marked ${!st.isActive ? 'Active' : 'Inactive'}`);
        } catch { toast.error('Status update failed'); }
    };

    /* ─── filtered + sorted list ───────────────────────────────────── */
    const filtered = [...serviceTypes]
        .filter(st => st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      st.description?.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => sortOrder === 'asc'
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name));

    /* ─── render ───────────────────────────────────────────────────── */
    return (
        <div>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="fw-extrabold text-dark mb-1">Service Type Management</h1>
                    <p className="text-muted mb-0">Manage service types like Installation, Maintenance, Diagnosis, Repair, etc.</p>
                </div>
                {!showForm && (
                    <button onClick={openCreate} className="btn btn-brand fw-bold d-flex align-items-center gap-2 px-4 shadow-sm">
                        <FaPlus /><span>Add Service Type</span>
                    </button>
                )}
            </div>

            {/* Form */}
            {showForm && (
                <div ref={formRef} className="card border-0 shadow-sm rounded-3 bg-white p-4 mb-4">
                    <h5 className="fw-bold mb-4 border-bottom pb-2">
                        {editingId ? 'Edit Service Type' : 'Create New Service Type'}
                    </h5>
                    <form onSubmit={handleSubmit}>
                        <div className="row g-3 mb-3">
                            <div className="col-md-6">
                                <label className="form-label text-muted small fw-bold">Service Type Name *</label>
                                <input
                                    type="text"
                                    required
                                    className="form-control bg-light border-0"
                                    placeholder="e.g. Installation, Maintenance, Diagnosis"
                                    value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label text-muted small fw-bold">Description</label>
                                <input
                                    type="text"
                                    className="form-control bg-light border-0"
                                    placeholder="Short description (optional)"
                                    value={form.description}
                                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="d-flex gap-2 justify-content-end">
                            <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline-secondary px-4">Cancel</button>
                            <button type="submit" disabled={saving} className="btn btn-brand fw-bold px-4 shadow-sm">
                                {saving ? 'Saving…' : editingId ? 'Update Service Type' : 'Create Service Type'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Table card */}
            <div className="card border-0 shadow-sm rounded-3 bg-white p-4">
                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                    <input
                        type="text"
                        className="form-control"
                        style={{ maxWidth: 350 }}
                        placeholder="Search service types…"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <select
                        className="form-select"
                        style={{ width: 180 }}
                        value={sortOrder}
                        onChange={e => setSortOrder(e.target.value)}
                    >
                        <option value="asc">Ascending (A–Z)</option>
                        <option value="desc">Descending (Z–A)</option>
                    </select>
                </div>

                {loading ? (
                    <div className="py-5 text-center text-muted">Loading…</div>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-hover align-middle">
                            <thead className="table-light border-0">
                                <tr>
                                    <th>#</th>
                                    <th>Service Type</th>
                                    <th>Description</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((st, idx) => (
                                    <tr key={st._id}>
                                        <td className="text-muted small">{idx + 1}</td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <div
                                                    className="d-flex align-items-center justify-content-center rounded-2 flex-shrink-0"
                                                    style={{ width: 34, height: 34, background: 'rgba(165,115,47,0.1)' }}
                                                >
                                                    <FaWrench size={14} style={{ color: '#A5732F' }} />
                                                </div>
                                                <span className="fw-bold text-dark">{st.name}</span>
                                            </div>
                                        </td>
                                        <td className="text-muted small">{st.description || '—'}</td>
                                        <td>
                                            {st.isActive ? (
                                                <span className="text-success d-flex align-items-center gap-1 small fw-bold">
                                                    <FaCheckCircle /><span>Active</span>
                                                </span>
                                            ) : (
                                                <span className="text-danger d-flex align-items-center gap-1 small fw-bold">
                                                    <FaTimesCircle /><span>Inactive</span>
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="d-flex gap-1">
                                                <button
                                                    onClick={() => openEdit(st)}
                                                    className="btn btn-sm btn-light border"
                                                    style={{ color: '#A5732F' }}
                                                    title="Edit"
                                                >
                                                    <FaEdit size={13} />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(st)}
                                                    className="btn btn-sm btn-light border"
                                                    title={st.isActive ? 'Deactivate' : 'Activate'}
                                                >
                                                    <span style={{ fontSize: 11 }}>{st.isActive ? 'Deactivate' : 'Activate'}</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(st._id)}
                                                    className="btn btn-sm btn-light border text-danger"
                                                    title="Delete"
                                                >
                                                    <FaTrash size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="text-center py-5 text-muted">
                                            No service types found. Create your first one!
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ServiceTypeManagement;
