import '../styles/CatalogManagementLayout.css';
import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { FiChevronRight, FiEdit, FiFilter, FiGrid, FiPlus, FiSearch, FiTrash2, FiX } from 'react-icons/fi';
import AdminImage from './AdminImage';
import Pagination from './Pagination';
import { getImageUrl } from '../utils/helpers';
import '../styles/CatalogManagement.css';

export const loadCatalog = async (fetchPage, key) => {
    const first = await fetchPage({ page: 1, limit: 100 });
    if (!first.success) throw new Error('Unable to load catalog');
    const items = [...first.data[key]];
    for (let page = 2; page <= (first.pagination?.totalPages || 1); page += 1) {
        const next = await fetchPage({ page, limit: 100 });
        if (!next.success) throw new Error('Unable to load catalog');
        items.push(...next.data[key]);
    }
    return items;
};

const CatalogManagementLayout = ({ kind, items, categories, loading, onCreate, onEdit, onDelete, onToggle, showForm, children }) => {
    const isCategory = kind === 'categories';
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('asc');
    const [category, setCategory] = useState('');
    const [subcategory, setSubcategory] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [pending, setPending] = useState([]);
    const label = isCategory ? 'categories' : 'subcategories';
    const subOptions = isCategory
        ? items.flatMap(item => item.subcategories || []).filter(item => !category || String(item.category) === category)
        : items.filter(item => !category || item.category?._id === category);
    const filtered = items.filter(item => {
        const parentId = isCategory ? item._id : item.category?._id;
        return (!search || `${item.name} ${item.category?.name || ''}`.toLowerCase().includes(search.toLowerCase()))
            && (!category || parentId === category)
            && (!subcategory || (isCategory ? item.subcategories?.some(sub => sub._id === subcategory) : item._id === subcategory))
            && (!status || (status === 'active' ? item.isActive : !item.isActive));
    }).sort((a, b) => sort === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
    const currentPage = Math.min(page, totalPages);
    const visible = filtered.slice((currentPage - 1) * limit, currentPage * limit);
    useEffect(() => { setPage(1); }, [search, sort, category, subcategory, status, limit]);
    const toggle = async item => {
        setPending(previous => [...previous, item._id]);
        try { await onToggle(item._id, !item.isActive); }
        finally { setPending(previous => previous.filter(id => id !== item._id)); }
    };
    return (
        <section className="catalog-management">
            <div className="catalog-breadcrumb">Customer Management <FiChevronRight /> <span>Services</span></div>
            <h1>Service Management</h1>
            <p className="catalog-description">Customer-facing catalog: pricing, quote type, and availability</p>
            <div className="catalog-filters">
                <div className="catalog-search"><input type="search" aria-label="Search categories and subcategories" placeholder="Search by category, sub category or service" value={search} onChange={event => setSearch(event.target.value)} /><span className="catalog-search-icon"><FiSearch /></span></div>
                <div className="catalog-sort"><FiFilter /><select aria-label="Sort catalog" value={sort} onChange={event => setSort(event.target.value)}><option value="asc">Sort: A–Z</option><option value="desc">Sort: Z–A</option></select></div>
                <label>Category<select value={category} onChange={event => { setCategory(event.target.value); setSubcategory(''); }}><option value="">All</option>{categories.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
                <label>Sub Category<select value={subcategory} onChange={event => setSubcategory(event.target.value)}><option value="">All</option>{subOptions.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
                <label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
                <button className="catalog-reset" onClick={() => { setSearch(''); setSort('asc'); setCategory(''); setSubcategory(''); setStatus(''); setPage(1); }}><FiX /> Reset</button>
            </div>
            <nav className="catalog-tabs" aria-label="Service catalog"><NavLink to="/categories">Categories</NavLink><NavLink to="/subcategories">Sub Categories</NavLink></nav>
            <div className="catalog-toolbar"><strong>{loading ? 'Loading catalog…' : `${filtered.length} ${label} · ${filtered.filter(item => item.isActive).length} active`}</strong>{!showForm && <button className="catalog-create" onClick={onCreate}><FiPlus /> Create {isCategory ? 'Category' : 'Sub Category'}</button>}</div>
            {children}
            <div className="catalog-table-container" aria-busy={loading}>
                <table className="catalog-table">
                    <thead><tr><th>Icon</th><th>Category</th>{!isCategory && <th>Sub Category</th>}<th>{isCategory ? 'Services under it' : 'Starting price'}</th><th>Active</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>{loading ? <tr><td colSpan={isCategory ? 6 : 7} className="catalog-empty">Loading {label}…</td></tr> : visible.map(item => <tr key={item._id}>
                        <td><div className="catalog-icon">{item.icon || item.image ? <AdminImage key={item.icon || item.image} src={getImageUrl(item.icon || item.image)} alt={item.name} width={64} height={64} objectFit="contain" className="admin-catalog-management-layout-1"  /> : <FiGrid />}</div></td>
                        <td className="catalog-name">{isCategory ? item.name : item.category?.name || '—'}</td>
                        {!isCategory && <td className="catalog-name">{item.name}<small className="catalog-service-count">{item.serviceCount || 0} {(item.serviceCount || 0) === 1 ? 'service' : 'services'}</small></td>}
                        <td>{isCategory ? <span className="catalog-count">{item.serviceCount || 0} {(item.serviceCount || 0) === 1 ? 'service' : 'services'}</span> : <span className="catalog-count">{item.startingFromPrice ? `$${item.startingFromPrice}` : '—'}</span>}</td>
                        <td><button type="button" role="switch" aria-checked={Boolean(item.isActive)} aria-label={`Active status for ${item.name}`} disabled={pending.includes(item._id)} className={`catalog-switch ${item.isActive ? 'is-active' : ''}`} onClick={() => toggle(item)}><span /></button></td>
                        <td><span className={`catalog-status ${item.isActive ? 'is-active' : item.status === 'draft' ? 'is-draft' : 'is-inactive'}`}>• {item.isActive ? 'Active' : item.status === 'draft' ? 'Draft' : 'Inactive'}</span></td>
                        <td><div className="catalog-actions"><button onClick={() => onEdit(item)} aria-label={`Edit ${item.name}`} title="Edit"><FiEdit /></button><button onClick={() => onDelete(item._id)} aria-label={`Delete ${item.name}`} title="Delete"><FiTrash2 /></button></div></td>
                    </tr>)}{!loading && visible.length === 0 && <tr><td className="catalog-empty" colSpan={isCategory ? 6 : 7}>No {label} found.</td></tr>}</tbody>
                </table>
            </div>
            {!loading && <div className="catalog-pagination"><Pagination page={currentPage} limit={limit} total={filtered.length} totalPages={totalPages} onPageChange={setPage} onLimitChange={setLimit} /></div>}
        </section>
    );
};
export default CatalogManagementLayout;
