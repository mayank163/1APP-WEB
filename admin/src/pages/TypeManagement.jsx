import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Modal } from 'react-bootstrap';
import { FiX, FiChevronDown, FiChevronRight, FiEdit2, FiMoreVertical } from 'react-icons/fi';
import { toast } from 'react-toastify';
import adminApi from '../services/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
import Pagination from '../components/Pagination';
import '../styles/TypeManagement.css';

const blank = { name: '', description: '', isActive: true, subName: '', subDescription: '' };
const Badge = ({ active }) => <span className={`types-badge ${active ? 'is-active' : ''}`}>• {active ? 'Active' : 'Inactive'}</span>;

export default function TypeManagement() {
    const { can } = useAdminAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const tab = location.pathname === '/service-types' ? 'service' : 'work';
    const resource = tab === 'work' ? 'work_types' : 'service_types';
    const writable = can(resource, 'write');
    const [workTypes, setWorkTypes] = useState([]);
    const [serviceTypes, setServiceTypes] = useState([]);
    const [serviceCount, setServiceCount] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expanded, setExpanded] = useState({});
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [category, setCategory] = useState('all');
    const [sort, setSort] = useState('asc');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [dialog, setDialog] = useState(null);
    const [form, setForm] = useState(blank);
    const [saving, setSaving] = useState(false);
    const submitting = useRef(false);
    const [menu, setMenu] = useState(null);
    const readWork = can('work_types', 'read');
    const readService = can('service_types', 'read');
    const readCatalog = can('services', 'read');
    const load = useCallback(async () => {
        setLoading(true); setError('');
        const results = await Promise.allSettled([
            readWork ? adminApi.getWorkTypes() : Promise.resolve(null),
            readService ? adminApi.getServiceTypes() : Promise.resolve(null),
            readCatalog ? adminApi.getServices({ limit: 1 }) : Promise.resolve(null),
        ]);
        if (results[0].status === 'fulfilled' && results[0].value) setWorkTypes(results[0].value.data.workTypes);
        if (results[1].status === 'fulfilled' && results[1].value) setServiceTypes(results[1].value.data.serviceTypes);
        if (results[2].status === 'fulfilled' && results[2].value) {
            const response = results[2].value;
            setServiceCount(response.pagination?.total ?? response.data?.pagination?.total ?? response.total ?? null);
        }
        if (results.slice(0, 2).some(result => result.status === 'rejected')) setError('Some types could not be loaded. Please try again.');
        setLoading(false);
    }, [readWork, readService, readCatalog]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { setPage(1); setSearch(''); setCategory('all'); setStatus('all'); setMenu(null); }, [tab]);
    useEffect(() => {
        if (!menu) return;
        const close = event => { if (!event.target.closest('.types-actions')) setMenu(null); };
        const escape = event => { if (event.key === 'Escape') setMenu(null); };
        document.addEventListener('click', close); document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', escape); };
    }, [menu]);
    const open = (kind, item = null, parent = null) => {
        setMenu(null);
        setForm({ ...blank, ...(item || {}) });
        setDialog({ kind, item, parent });
    };
    const close = () => { if (!submitting.current) setDialog(null); };
    const save = async event => {
        event.preventDefault();
        if (submitting.current || !form.name.trim()) return;
        submitting.current = true; setSaving(true);
        const payload = { name: form.name.trim(), description: form.description.trim(), isActive: form.isActive };
        try {
            if (dialog.kind === 'sub') {
                if (dialog.item) await adminApi.updateWorkSubType(dialog.parent._id, dialog.item._id, payload);
                else await adminApi.addWorkSubType(dialog.parent._id, payload);
                setExpanded(previous => ({ ...previous, [dialog.parent._id]: true }));
            } else if (dialog.kind === 'work') {
                if (dialog.item) await adminApi.updateWorkType(dialog.item._id, payload);
                else await adminApi.createWorkType({ ...payload, subTypes: [{ name: form.subName.trim(), description: form.subDescription.trim(), isActive: form.isActive }] });
            } else if (dialog.item) await adminApi.updateServiceType(dialog.item._id, payload);
            else await adminApi.createServiceType(payload);
            setDialog(null); toast.success('Saved successfully'); await load();
        } catch (err) { toast.error(err.response?.data?.message || 'Unable to save. Please try again.'); }
        finally { submitting.current = false; setSaving(false); }
    };
    const changeStatus = async (kind, item, parent) => {
        setMenu(null);
        try {
            if (kind === 'sub') await adminApi.updateWorkSubType(parent._id, item._id, { isActive: !item.isActive });
            else if (kind === 'work') await adminApi.updateWorkType(item._id, { isActive: !item.isActive });
            else await adminApi.toggleServiceTypeStatus(item._id, !item.isActive);
            await load();
        } catch (err) { toast.error(err.response?.data?.message || 'Unable to update status'); }
    };
    const remove = async (kind, item, parent) => {
        setMenu(null);
        if (!window.confirm(`Delete "${item.name}"${kind === 'work' ? ' and all its sub-types' : ''}?`)) return;
        try {
            if (kind === 'sub') await adminApi.deleteWorkSubType(parent._id, item._id);
            else if (kind === 'work') await adminApi.deleteWorkType(item._id);
            else await adminApi.deleteServiceType(item._id);
            toast.success('Deleted successfully'); await load();
        } catch (err) { toast.error(err.response?.data?.message || 'Unable to delete'); }
    };
    const actions = (kind, item, parent) => writable && <div className="types-actions">
        <button aria-label={`Edit ${item.name}`} onClick={() => open(kind, item, parent)}><FiEdit2 /></button>
        <button aria-label={`More actions for ${item.name}`} aria-expanded={menu === item._id} onClick={() => setMenu(menu === item._id ? null : item._id)}><FiMoreVertical /></button>
        {menu === item._id && <div className="types-action-menu"><button onClick={() => changeStatus(kind, item, parent)}>{item.isActive ? 'Deactivate' : 'Activate'}</button><button className="types-delete" onClick={() => remove(kind, item, parent)}>Delete</button></div>}
    </div>;
    const filtered = (tab === 'work' ? workTypes : serviceTypes).filter(item => {
        const text = `${item.name} ${item.description || ''} ${(item.subTypes || []).map(sub => `${sub.name} ${sub.description || ''}`).join(' ')}`.toLowerCase();
        return text.includes(search.toLowerCase()) && (status === 'all' || item.isActive === (status === 'active')) && (tab !== 'work' || category === 'all' || item._id === category);
    }).sort((a, b) => sort === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
    const currentPage = Math.min(page, totalPages);
    const visible = filtered.slice((currentPage - 1) * limit, currentPage * limit);
    const title = dialog?.kind === 'sub' ? 'Sub-Type' : dialog?.kind === 'work' ? 'Work Type' : 'Service Type';
    const tabs = className => <div className={className} role="tablist" aria-label="Type management">
        {readWork && <button role="tab" aria-selected={tab === 'work'} className={tab === 'work' ? 'selected' : ''} onClick={() => navigate('/work-types')}>Work Types <span>{workTypes.length}</span></button>}
        {readService && <button role="tab" aria-selected={tab === 'service'} className={tab === 'service' ? 'selected' : ''} onClick={() => navigate('/service-types')}>Service Types <span>{serviceTypes.length}</span></button>}
    </div>;
    if (!can(resource, 'read')) return <div>Access Denied</div>;
    return <section className="type-management">
        <div className="types-heading"><div><div className="types-breadcrumb">Customer Management <FiChevronRight /> <span>Services</span></div><h1>Work &amp; Service Type Management</h1><p>Manage work categories, sub-types and service types used across services, bookings<br className="types-desktop-break" /> and technician operations.</p></div>{readCatalog && <Link to="/services" className="types-primary types-view">View Services</Link>}</div>
        <div className="types-summary">{[[ 'Work Types', readWork ? workTypes.length : '—'], ['Sub-Types', readWork ? workTypes.reduce((sum, item) => sum + (item.subTypes?.length || 0), 0) : '—'], ['Services', serviceCount ?? '—'], ['Service Types', readService ? serviceTypes.length : '—']].map(([label, value]) => <div key={label}><h2>{label}</h2><strong>{loading ? '…' : value}</strong></div>)}</div>
        {tabs('types-tabs')}
        <div className="types-filters"><div className="types-search"><input aria-label="Search types" placeholder="Search work types, sub-types or service types" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div><label className="types-sort"><select aria-label="Sort types" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}><option value="asc">Sort A–Z</option><option value="desc">Sort Z–A</option></select></label>{tab === 'work' && <label>Category<select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}><option value="all">All</option>{workTypes.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>}<label>Status<select aria-label="Status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label><button className="types-primary" onClick={() => { setSearch(''); setCategory('all'); setStatus('all'); setSort('asc'); setPage(1); }}>Reset</button></div>
        <div className="types-toolbar">{tabs('types-pills')}{writable && <button className="types-primary" onClick={() => open(tab)}>Create {tab === 'work' ? 'Work' : 'Service'} Type</button>}</div>
        {error && <div className="types-error" role="alert">{error} <button onClick={load}>Retry</button></div>}
        {loading ? <div className="types-empty" role="status">Loading types…</div> : visible.length === 0 ? <div className="types-empty">No {tab === 'work' ? 'work' : 'service'} types found.</div> : tab === 'work' ? <div className="types-work-list">{visible.map(item => {
            return <article className={`types-work-card ${expanded[item._id] ? 'expanded' : ''}`} key={item._id}><div className="types-work-row"><button className="types-expand" aria-label={`${expanded[item._id] ? 'Collapse' : 'Expand'} ${item.name}`} aria-expanded={!!expanded[item._id]} onClick={() => setExpanded(previous => ({ ...previous, [item._id]: !previous[item._id] }))}>{expanded[item._id] ? <FiChevronDown /> : <FiChevronRight />}</button><div className="types-work-name"><h3>{item.name}</h3><p>{item.description || 'No description provided.'}</p></div><div className="types-count"><strong>{item.subTypes?.length || 0}</strong><span>SUB-TYPES</span></div><Badge active={item.isActive} />{actions('work', item)}</div>{expanded[item._id] && <div className="types-sub-content"><div className="types-table-wrap"><table className="types-table types-sub-table"><thead><tr><th>SUB-TYPE</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{(item.subTypes || []).map(sub => <tr key={sub._id}><td><strong>{sub.name}</strong><p>{sub.description || '—'}</p></td><td><Badge active={sub.isActive} /></td><td>{actions('sub', sub, item)}</td></tr>)}{!item.subTypes?.length && <tr><td colSpan="3">No sub-types yet.</td></tr>}</tbody></table></div>{writable && <button className="types-add-sub" onClick={() => open('sub', null, item)}>Add Sub-Type</button>}</div>}</article>;
        })}</div> : <div className="types-table-wrap types-service-table"><table className="types-table"><thead><tr><th>S.NO</th><th>SERVICE TYPE</th><th>DESCRIPTION</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{visible.map((item, index) => <tr key={item._id}><td className="types-number">{String((currentPage - 1) * limit + index + 1).padStart(2, '0')}</td><td><div className="types-service-name"><strong>{item.name}</strong></div></td><td className="types-description">{item.description || '—'}</td><td><Badge active={item.isActive} /></td><td>{actions('service', item)}</td></tr>)}</tbody></table></div>}
        {!loading && <Pagination page={currentPage} totalPages={totalPages} total={filtered.length} limit={limit} onPageChange={setPage} onLimitChange={value => { setLimit(value); setPage(1); }} />}
        <Modal show={!!dialog} onHide={close} centered backdrop={saving ? 'static' : true} keyboard={!saving} dialogClassName="types-modal" aria-labelledby="types-dialog-title"><form onSubmit={save}><Modal.Header><div><h2 id="types-dialog-title">{dialog?.item ? 'Edit' : 'Create'} {title}</h2><p>{dialog?.kind === 'service' ? 'Define the nature of work performed' : dialog?.kind === 'sub' ? 'Add a sub-type to organise your work category.' : 'Add a new category to organise your catalogue.'}</p></div><button type="button" aria-label="Close dialog" onClick={close} disabled={saving}><FiX /></button></Modal.Header><Modal.Body>
            <label htmlFor="type-name">{title} Name <em>*</em></label><input id="type-name" autoFocus required maxLength={150} value={form.name} placeholder="e.g. Cameras, Access & Alarms" onChange={e => setForm({ ...form, name: e.target.value })} />
            <label htmlFor="type-description">Description <span>(optional)</span></label><textarea id="type-description" value={form.description} placeholder="Add a short description..." onChange={e => setForm({ ...form, description: e.target.value })} />
            {dialog?.kind === 'work' && !dialog.item && <><label htmlFor="sub-name">Sub - Work Type Name <em>*</em></label><input id="sub-name" required maxLength={150} value={form.subName} placeholder="e.g. Cameras, Access & Alarms" onChange={e => setForm({ ...form, subName: e.target.value })} /><label htmlFor="sub-description">Sub-Work Type Description <span>(optional)</span></label><textarea id="sub-description" value={form.subDescription} placeholder="Add a short description..." onChange={e => setForm({ ...form, subDescription: e.target.value })} /></>}
            <label className="types-status-label">Status</label><div className="types-status-control"><button type="button" role="switch" aria-label="Active status" aria-checked={form.isActive} className={`types-switch ${form.isActive ? 'on' : ''}`} onClick={() => setForm({ ...form, isActive: !form.isActive })}><span /></button><strong>{form.isActive ? 'Active' : 'Inactive'}</strong><span>Inactive items are hidden from new service configuration</span></div>
        </Modal.Body><Modal.Footer><button type="button" className="types-cancel" onClick={close} disabled={saving}>Cancel</button><button type="submit" className="types-primary" disabled={saving}>{saving ? 'Saving…' : `${dialog?.item ? 'Save' : 'Create'} ${title}`}</button></Modal.Footer></form></Modal>
    </section>;
}
