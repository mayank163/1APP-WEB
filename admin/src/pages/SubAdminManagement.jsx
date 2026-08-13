import React, { useEffect, useState, useCallback } from 'react';
import adminApi from '../services/adminApi';
import { toast } from 'react-toastify';
import { FaPlus, FaEdit, FaTrash, FaUserShield, FaTimes } from 'react-icons/fa';

const RESOURCE_LABELS = {
    dashboard: 'Dashboard',
    bookings: 'Bookings',
    categories: 'Categories',
    subcategories: 'Sub-Categories',
    services: 'Services',
    users: 'Users',
    offers: 'Offers & Coupons',
    technician_jobs: 'Technician Jobs',
    technician_verification: 'Technician Verification',
    blogs: 'Blogs',
    sub_admins: 'Sub-Admin Management',
};

const ACCESS_OPTIONS = [
    { value: 'read', label: 'Read Only' },
    { value: 'write', label: 'Write Only' },
    { value: 'both', label: 'Read & Write' },
];

const EMPTY_FORM = { name: '', email: '', password: '', permissions: [] };

const PermissionRow = ({ resource, perm, onChange, onRemove }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8f9fa', borderRadius: 8, marginBottom: 6 }}>
        <span style={{ flex: 1, fontWeight: 600, fontSize: '0.85rem', color: '#333' }}>
            {RESOURCE_LABELS[resource] || resource}
        </span>
        <select
            value={perm}
            onChange={e => onChange(resource, e.target.value)}
            style={{ border: '1.5px solid #ddd', borderRadius: 6, padding: '4px 8px', fontSize: '0.82rem', color: '#333' }}
        >
            {ACCESS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button type="button" onClick={() => onRemove(resource)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc3545', padding: 4 }}>
            <FaTimes size={12} />
        </button>
    </div>
);

const Modal = ({ title, onClose, children }) => (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f0e8dc' }}>
                <h5 style={{ margin: 0, fontWeight: 700, color: '#1a1208' }}>{title}</h5>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 18 }}>×</button>
            </div>
            <div style={{ padding: '24px' }}>{children}</div>
        </div>
    </div>
);

const SubAdminManagement = () => {
    const [subAdmins, setSubAdmins] = useState([]);
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // null | 'create' | 'edit'
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        try {
            const [adminsRes, resourcesRes] = await Promise.all([
                adminApi.getSubAdmins(),
                adminApi.getResources(),
            ]);
            setSubAdmins(adminsRes.data?.admins || []);
            setResources(resourcesRes.data?.resources || []);
        } catch {
            toast.error('Failed to load sub-admins.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const openCreate = () => {
        setForm(EMPTY_FORM);
        setEditing(null);
        setModal('create');
    };

    const openEdit = (admin) => {
        const permsMap = {};
        (admin.permissions || []).forEach(p => { permsMap[p.resource] = p.access; });
        setForm({ name: admin.name, email: admin.email, password: '', permissions: admin.permissions || [] });
        setEditing(admin);
        setModal('edit');
    };

    const closeModal = () => { setModal(null); setEditing(null); setForm(EMPTY_FORM); };

    // Permission helpers
    const permMap = Object.fromEntries(form.permissions.map(p => [p.resource, p.access]));

    const addResource = (resource) => {
        if (permMap[resource]) return;
        setForm(f => ({ ...f, permissions: [...f.permissions, { resource, access: 'read' }] }));
    };

    const changeAccess = (resource, access) => {
        setForm(f => ({ ...f, permissions: f.permissions.map(p => p.resource === resource ? { ...p, access } : p) }));
    };

    const removeResource = (resource) => {
        setForm(f => ({ ...f, permissions: f.permissions.filter(p => p.resource !== resource) }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (modal === 'create') {
                await adminApi.createSubAdmin({ name: form.name, email: form.email, password: form.password, permissions: form.permissions });
                toast.success('Sub-admin created.');
            } else {
                const payload = { name: form.name, permissions: form.permissions };
                if (form.password) payload.password = form.password;
                await adminApi.updateSubAdmin(editing._id, payload);
                toast.success('Sub-admin updated.');
            }
            closeModal();
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Operation failed.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this sub-admin?')) return;
        try {
            await adminApi.deleteSubAdmin(id);
            toast.success('Sub-admin deleted.');
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Delete failed.');
        }
    };

    const toggleActive = async (admin) => {
        try {
            await adminApi.updateSubAdmin(admin._id, { isActive: !admin.isActive });
            toast.success(`Sub-admin ${admin.isActive ? 'deactivated' : 'activated'}.`);
            load();
        } catch {
            toast.error('Failed to update status.');
        }
    };

    const unusedResources = resources.filter(r => !permMap[r]);

    if (loading) return <div className="d-flex align-items-center gap-2 p-4"><div className="spinner-border spinner-border-sm text-warning" /><span>Loading...</span></div>;

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h4 style={{ fontWeight: 800, margin: 0, color: '#1a1208' }}>Sub-Admin Management</h4>
                    <p style={{ color: '#888', margin: '4px 0 0', fontSize: '0.88rem' }}>Create admins with granular RBAC permissions</p>
                </div>
                <button
                    onClick={openCreate}
                    style={{ background: '#A5732F', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                    <FaPlus size={12} /> Add Sub-Admin
                </button>
            </div>

            {/* Table */}
            {subAdmins.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#aaa' }}>
                    <FaUserShield size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                    <p style={{ fontWeight: 600 }}>No sub-admins yet</p>
                    <p style={{ fontSize: '0.85rem' }}>Create one to delegate access with specific permissions.</p>
                </div>
            ) : (
                <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #f0e8dc', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#fdf6ee', borderBottom: '1px solid #f0e8dc' }}>
                                {['Name', 'Email', 'Permissions', 'Status', 'Actions'].map(h => (
                                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#A5732F', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {subAdmins.map((admin, i) => (
                                <tr key={admin._id} style={{ borderBottom: i < subAdmins.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                                    <td style={{ padding: '14px 16px', fontWeight: 600, color: '#1a1208' }}>{admin.name}</td>
                                    <td style={{ padding: '14px 16px', color: '#555', fontSize: '0.88rem' }}>{admin.email}</td>
                                    <td style={{ padding: '14px 16px' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                            {(admin.permissions || []).length === 0 ? (
                                                <span style={{ color: '#bbb', fontSize: '0.8rem' }}>No permissions</span>
                                            ) : (
                                                admin.permissions.map(p => (
                                                    <span key={p.resource} style={{
                                                        background: p.access === 'both' ? '#e8f5e9' : p.access === 'write' ? '#fff3e0' : '#e3f2fd',
                                                        color: p.access === 'both' ? '#2e7d32' : p.access === 'write' ? '#e65100' : '#1565c0',
                                                        borderRadius: 4, padding: '2px 7px', fontSize: '0.75rem', fontWeight: 600
                                                    }}>
                                                        {RESOURCE_LABELS[p.resource] || p.resource} · {p.access}
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                        <button
                                            onClick={() => toggleActive(admin)}
                                            style={{
                                                background: admin.isActive ? '#e8f5e9' : '#fce4ec',
                                                color: admin.isActive ? '#2e7d32' : '#c62828',
                                                border: 'none', borderRadius: 20, padding: '4px 12px',
                                                fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer'
                                            }}
                                        >
                                            {admin.isActive ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button onClick={() => openEdit(admin)} style={{ background: '#fff3e0', color: '#e65100', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>
                                                <FaEdit size={13} />
                                            </button>
                                            <button onClick={() => handleDelete(admin._id)} style={{ background: '#fce4ec', color: '#c62828', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>
                                                <FaTrash size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create / Edit Modal */}
            {modal && (
                <Modal title={modal === 'create' ? 'Create Sub-Admin' : 'Edit Sub-Admin'} onClose={closeModal}>
                    <form onSubmit={handleSubmit}>
                        {/* Name */}
                        <div style={{ marginBottom: 14 }}>
                            <label style={{ fontWeight: 700, fontSize: '0.83rem', display: 'block', marginBottom: 5 }}>Name</label>
                            <input
                                required
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                style={{ width: '100%', border: '1.5px solid #ddd', borderRadius: 8, padding: '9px 12px', fontSize: '0.9rem', boxSizing: 'border-box' }}
                                placeholder="Full name"
                            />
                        </div>

                        {/* Email */}
                        <div style={{ marginBottom: 14 }}>
                            <label style={{ fontWeight: 700, fontSize: '0.83rem', display: 'block', marginBottom: 5 }}>Email</label>
                            <input
                                required
                                type="email"
                                value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                disabled={modal === 'edit'}
                                style={{ width: '100%', border: '1.5px solid #ddd', borderRadius: 8, padding: '9px 12px', fontSize: '0.9rem', boxSizing: 'border-box', background: modal === 'edit' ? '#f5f5f5' : '#fff' }}
                                placeholder="admin@example.com"
                            />
                        </div>

                        {/* Password */}
                        <div style={{ marginBottom: 20 }}>
                            <label style={{ fontWeight: 700, fontSize: '0.83rem', display: 'block', marginBottom: 5 }}>
                                Password {modal === 'edit' && <span style={{ color: '#aaa', fontWeight: 400 }}>(leave blank to keep current)</span>}
                            </label>
                            <input
                                required={modal === 'create'}
                                type="password"
                                value={form.password}
                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                style={{ width: '100%', border: '1.5px solid #ddd', borderRadius: 8, padding: '9px 12px', fontSize: '0.9rem', boxSizing: 'border-box' }}
                                placeholder="••••••••"
                            />
                        </div>

                        {/* Permissions */}
                        <div style={{ marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <label style={{ fontWeight: 700, fontSize: '0.83rem' }}>Permissions</label>
                                {unusedResources.length > 0 && (
                                    <select
                                        value=""
                                        onChange={e => { if (e.target.value) addResource(e.target.value); }}
                                        style={{ border: '1.5px solid #A5732F', borderRadius: 6, padding: '4px 8px', fontSize: '0.8rem', color: '#A5732F', cursor: 'pointer' }}
                                    >
                                        <option value="">+ Add resource</option>
                                        {unusedResources.map(r => <option key={r} value={r}>{RESOURCE_LABELS[r] || r}</option>)}
                                    </select>
                                )}
                            </div>

                            {form.permissions.length === 0 ? (
                                <p style={{ color: '#bbb', fontSize: '0.83rem', textAlign: 'center', padding: '16px 0' }}>No permissions assigned. Use "+ Add resource" above.</p>
                            ) : (
                                form.permissions.map(p => (
                                    <PermissionRow
                                        key={p.resource}
                                        resource={p.resource}
                                        perm={p.access}
                                        onChange={changeAccess}
                                        onRemove={removeResource}
                                    />
                                ))
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button type="button" onClick={closeModal} style={{ background: '#f5f5f5', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                            <button type="submit" disabled={saving} style={{ background: '#A5732F', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                                {saving ? 'Saving...' : modal === 'create' ? 'Create Sub-Admin' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default SubAdminManagement;
