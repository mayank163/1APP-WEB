import React, { useEffect, useRef, useState } from 'react';
import adminApi from '../services/adminApi';
import { FaPlus, FaEdit, FaTrash, FaChevronDown, FaChevronRight, FaLayerGroup } from 'react-icons/fa';
import { toast } from 'react-toastify';

/* ─── tiny helpers ─────────────────────────────────────────────────── */
const Badge = ({ active }) => (
    <span className={`badge rounded-pill ${active ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: 11 }}>
        {active ? 'Active' : 'Inactive'}
    </span>
);

const EMPTY_FORM = { name: '', description: '' };

/* ═══════════════════════════════════════════════════════════════════ */
const WorkTypeManagement = () => {
    const [workTypes, setWorkTypes]   = useState([]);
    const [loading, setLoading]       = useState(true);
    const [expanded, setExpanded]     = useState({});   // { [id]: bool }

    /* ── top-level form ── */
    const [showForm, setShowForm]     = useState(false);
    const [editingId, setEditingId]   = useState(null);
    const [form, setForm]             = useState(EMPTY_FORM);
    const [saving, setSaving]         = useState(false);
    const formRef                     = useRef(null);

    /* ── sub-type inline form ── */
    const [subForm, setSubForm]       = useState(null);
    // subForm = { workTypeId, subId|null, name, description }

    const [searchTerm, setSearchTerm] = useState('');

    /* ─── fetch ────────────────────────────────────────────────────── */
    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getWorkTypes();
            if (res.success) setWorkTypes(res.data.workTypes);
        } catch { toast.error('Failed to load work types'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, []);

    /* ─── expand / collapse ────────────────────────────────────────── */
    const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

    /* ─── top-level CRUD ───────────────────────────────────────────── */
    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setShowForm(true);
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    const openEdit = (wt) => {
        setEditingId(wt._id);
        setForm({ name: wt.name, description: wt.description || '' });
        setShowForm(true);
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this work type and all its sub-types?')) return;
        try {
            await adminApi.deleteWorkType(id);
            toast.success('Work type deleted');
            fetchData();
        } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
    };

    const handleToggleActive = async (wt) => {
        try {
            await adminApi.updateWorkType(wt._id, { isActive: !wt.isActive });
            setWorkTypes(prev => prev.map(w => w._id === wt._id ? { ...w, isActive: !w.isActive } : w));
        } catch { toast.error('Status update failed'); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error('Name is required'); return; }
        setSaving(true);
        try {
            if (editingId) {
                const res = await adminApi.updateWorkType(editingId, form);
                if (res.success) toast.success('Work type updated');
            } else {
                const res = await adminApi.createWorkType(form);
                if (res.success) toast.success('Work type created');
            }
            setShowForm(false);
            fetchData();
        } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
        finally { setSaving(false); }
    };

    /* ─── sub-type CRUD ────────────────────────────────────────────── */
    const openSubCreate = (workTypeId) => {
        setSubForm({ workTypeId, subId: null, name: '', description: '' });
        setExpanded(prev => ({ ...prev, [workTypeId]: true }));
    };

    const openSubEdit = (workTypeId, sub) => {
        setSubForm({ workTypeId, subId: sub._id, name: sub.name, description: sub.description || '' });
    };

    const cancelSubForm = () => setSubForm(null);

    const handleSubSubmit = async (e) => {
        e.preventDefault();
        if (!subForm.name.trim()) { toast.error('Sub-type name is required'); return; }
        const { workTypeId, subId, name, description } = subForm;
        try {
            if (subId) {
                await adminApi.updateWorkSubType(workTypeId, subId, { name, description });
                toast.success('Sub-type updated');
            } else {
                await adminApi.addWorkSubType(workTypeId, { name, description });
                toast.success('Sub-type added');
            }
            setSubForm(null);
            fetchData();
        } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
    };

    const handleDeleteSub = async (workTypeId, subId, subName) => {
        if (!window.confirm(`Delete sub-type "${subName}"?`)) return;
        try {
            await adminApi.deleteWorkSubType(workTypeId, subId);
            toast.success('Sub-type deleted');
            fetchData();
        } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
    };

    const handleToggleSubActive = async (wt, sub) => {
        try {
            await adminApi.updateWorkSubType(wt._id, sub._id, { isActive: !sub.isActive });
            fetchData();
        } catch { toast.error('Status update failed'); }
    };

    /* ─── filter ───────────────────────────────────────────────────── */
    const filtered = workTypes.filter(wt =>
        wt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wt.subTypes?.some(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    /* ─── render ───────────────────────────────────────────────────── */
    return (
        <div>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="fw-extrabold text-dark mb-1">Work Type Management</h1>
                    <p className="text-muted mb-0">Manage work categories (e.g. Camera &amp; Alarms) and their sub-types (e.g. Access Control, Burglar Alarm)</p>
                </div>
                {!showForm && (
                    <button onClick={openCreate} className="btn btn-brand fw-bold d-flex align-items-center gap-2 px-4 shadow-sm">
                        <FaPlus /><span>Add Work Type</span>
                    </button>
                )}
            </div>

            {/* Top-level form */}
            {showForm && (
                <div ref={formRef} className="card border-0 shadow-sm rounded-3 bg-white p-4 mb-4">
                    <h5 className="fw-bold mb-4 border-bottom pb-2">
                        {editingId ? 'Edit Work Type' : 'Create New Work Type'}
                    </h5>
                    <form onSubmit={handleSubmit}>
                        <div className="row g-3 mb-3">
                            <div className="col-md-6">
                                <label className="form-label text-muted small fw-bold">Work Type Name *</label>
                                <input
                                    type="text"
                                    required
                                    className="form-control bg-light border-0"
                                    placeholder="e.g. Camera & Alarms, Access Control Systems"
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
                                {saving ? 'Saving…' : editingId ? 'Update Work Type' : 'Create Work Type'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Search */}
            <div className="card border-0 shadow-sm rounded-3 bg-white p-4">
                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                    <input
                        type="text"
                        className="form-control"
                        style={{ maxWidth: 350 }}
                        placeholder="Search work types or sub-types…"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <span className="text-muted small">{filtered.length} work type{filtered.length !== 1 ? 's' : ''}</span>
                </div>

                {/* List */}
                {loading ? (
                    <div className="py-5 text-center text-muted">Loading…</div>
                ) : filtered.length === 0 ? (
                    <div className="py-5 text-center text-muted">
                        <FaLayerGroup size={32} className="mb-3 opacity-25" />
                        <p className="mb-0">No work types found. Create your first one!</p>
                    </div>
                ) : (
                    <div className="d-flex flex-column gap-3">
                        {filtered.map(wt => (
                            <div key={wt._id} className="border rounded-3 overflow-hidden">
                                {/* Work-type row */}
                                <div
                                    className="d-flex align-items-center px-3 py-3 gap-2"
                                    style={{ background: '#faf7f2', borderBottom: expanded[wt._id] ? '1px solid #e9e4da' : 'none' }}
                                >
                                    <button
                                        className="btn btn-sm btn-light border-0 p-1"
                                        onClick={() => toggle(wt._id)}
                                        title={expanded[wt._id] ? 'Collapse' : 'Expand'}
                                    >
                                        {expanded[wt._id]
                                            ? <FaChevronDown size={12} style={{ color: '#A5732F' }} />
                                            : <FaChevronRight size={12} style={{ color: '#A5732F' }} />}
                                    </button>

                                    <div className="flex-grow-1">
                                        <span className="fw-bold text-dark me-2">{wt.name}</span>
                                        {wt.description && (
                                            <span className="text-muted small">— {wt.description}</span>
                                        )}
                                    </div>

                                    <span className="text-muted small me-2">
                                        {wt.subTypes?.filter(s => s.isActive).length ?? 0} / {wt.subTypes?.length ?? 0} sub-types
                                    </span>

                                    <Badge active={wt.isActive} />

                                    <div className="d-flex gap-1 ms-2">
                                        <button
                                            className="btn btn-sm btn-light border"
                                            style={{ color: '#A5732F' }}
                                            title="Edit"
                                            onClick={() => openEdit(wt)}
                                        >
                                            <FaEdit size={12} />
                                        </button>
                                        <button
                                            className="btn btn-sm btn-light border"
                                            title={wt.isActive ? 'Deactivate' : 'Activate'}
                                            onClick={() => handleToggleActive(wt)}
                                        >
                                            <span style={{ fontSize: 11 }}>{wt.isActive ? 'Deactivate' : 'Activate'}</span>
                                        </button>
                                        <button
                                            className="btn btn-sm btn-light border text-danger"
                                            title="Delete"
                                            onClick={() => handleDelete(wt._id)}
                                        >
                                            <FaTrash size={12} />
                                        </button>
                                        <button
                                            className="btn btn-sm btn-brand d-flex align-items-center gap-1"
                                            title="Add sub-type"
                                            onClick={() => openSubCreate(wt._id)}
                                        >
                                            <FaPlus size={10} /><span style={{ fontSize: 11 }}>Sub-type</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Sub-types */}
                                {expanded[wt._id] && (
                                    <div className="px-4 py-2" style={{ background: '#fff' }}>
                                        {/* Inline sub-type form */}
                                        {subForm?.workTypeId === wt._id && (
                                            <form onSubmit={handleSubSubmit} className="d-flex gap-2 align-items-center mb-3 mt-2 p-3 rounded-3" style={{ background: '#f8f4ee', border: '1px dashed #c9a96e' }}>
                                                <div className="flex-grow-1">
                                                    <input
                                                        type="text"
                                                        required
                                                        autoFocus
                                                        className="form-control form-control-sm bg-white border-0 shadow-sm mb-1"
                                                        placeholder="Sub-type name *  e.g. Access Control"
                                                        value={subForm.name}
                                                        onChange={e => setSubForm(p => ({ ...p, name: e.target.value }))}
                                                    />
                                                    <input
                                                        type="text"
                                                        className="form-control form-control-sm bg-white border-0 shadow-sm"
                                                        placeholder="Description (optional)"
                                                        value={subForm.description}
                                                        onChange={e => setSubForm(p => ({ ...p, description: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="d-flex gap-1">
                                                    <button type="submit" className="btn btn-sm btn-brand fw-bold px-3">
                                                        {subForm.subId ? 'Update' : 'Add'}
                                                    </button>
                                                    <button type="button" onClick={cancelSubForm} className="btn btn-sm btn-outline-secondary px-3">Cancel</button>
                                                </div>
                                            </form>
                                        )}

                                        {/* Sub-type list */}
                                        {wt.subTypes?.length === 0 ? (
                                            <p className="text-muted small py-2 mb-0">No sub-types yet. Click "+ Sub-type" to add one.</p>
                                        ) : (
                                            <table className="table table-sm table-hover align-middle mb-1">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th className="small text-muted fw-semibold">Sub-type Name</th>
                                                        <th className="small text-muted fw-semibold">Description</th>
                                                        <th className="small text-muted fw-semibold">Status</th>
                                                        <th className="small text-muted fw-semibold">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {wt.subTypes.map(sub => (
                                                        <tr key={sub._id}>
                                                            <td className="fw-semibold small">{sub.name}</td>
                                                            <td className="text-muted small">{sub.description || '—'}</td>
                                                            <td><Badge active={sub.isActive} /></td>
                                                            <td>
                                                                <div className="d-flex gap-1">
                                                                    <button
                                                                        className="btn btn-sm btn-light border"
                                                                        style={{ color: '#A5732F' }}
                                                                        title="Edit"
                                                                        onClick={() => openSubEdit(wt._id, sub)}
                                                                    >
                                                                        <FaEdit size={11} />
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-sm btn-light border"
                                                                        title={sub.isActive ? 'Deactivate' : 'Activate'}
                                                                        onClick={() => handleToggleSubActive(wt, sub)}
                                                                    >
                                                                        <span style={{ fontSize: 10 }}>{sub.isActive ? 'Deactivate' : 'Activate'}</span>
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-sm btn-light border text-danger"
                                                                        title="Delete"
                                                                        onClick={() => handleDeleteSub(wt._id, sub._id, sub.name)}
                                                                    >
                                                                        <FaTrash size={11} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkTypeManagement;
