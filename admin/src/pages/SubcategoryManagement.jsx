import React, { useCallback, useEffect, useState } from 'react';
import adminApi from '../services/adminApi';
import ServiceEditor from '../components/ServiceEditor';
import { ShimmerServiceTable } from '../components/Shimmer';
import { FaPlus, FaEdit, FaTrash, FaClock, FaSearch, FaFilter, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import Pagination from '../components/Pagination';
import '../styles/WebServices.css';

const SubcategoryManagement = () => {
    const [services, setServices] = useState([]);
    const [categories, setCategories] = useState([]);
    const [subcategories, setSubcategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState('updated');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0, draft: 0 });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [svcRes, catRes, subRes] = await Promise.all([
                adminApi.getServices({ page, limit: pageSize, search: searchTerm, sort: sortOrder, category: categoryFilter, status: statusFilter, includeSummary: 'true' }),
                adminApi.getCategories({ limit: 100 }),
                adminApi.getSubCategories('', { limit: 100 })
            ]);
            if (svcRes.success) {
                setServices(svcRes.data.services);
                if (svcRes.data.summary) setSummary(svcRes.data.summary);
                setPagination(svcRes.pagination || { page, limit: pageSize, total: svcRes.count || 0, totalPages: Math.max(1, Math.ceil((svcRes.count || 0) / pageSize)) });
            }
            if (catRes.success) setCategories(catRes.data.categories);
            if (subRes.success) setSubcategories(subRes.data.subcategories);
        } catch { toast.error('Failed to load services'); } finally { setLoading(false); }
    }, [page, pageSize, searchTerm, sortOrder, categoryFilter, statusFilter]);
    useEffect(() => { fetchData(); }, [fetchData]);
    const handleOpenCreate = () => { setEditingId(null); setShowForm(true); };
    const handleOpenEdit = service => { setEditingId(service._id); setShowForm(true); };
    const handleDelete = async id => {
        if (!window.confirm('Are you sure you want to delete this service?')) return;
        try { const result = await adminApi.deleteService(id); if (result.success) { toast.success('Service deleted'); fetchData(); } } catch { toast.error('Deletion failed'); }
    };
    // Helper to get display price
    const getDisplayPrice = (svc) => {
        if (svc.pricingType === 'quote') return 'Custom';
        if (svc.hasVariants && svc.variants?.length) {
            const prices = svc.variants.map(v => v.offerPrice || v.actualPrice);
            const min = Math.min(...prices);
            const max = Math.max(...prices);
            return min === max ? `$${min}` : `$${min} - $${max}`;
        }
        return `$${svc.offerPrice || svc.actualPrice || 0}`;
    };

    const getDisplayDuration = (svc) => {
        if (svc.hasVariants && svc.variants?.length) {
            const durations = svc.variants.map(v => v.duration).filter(d => d > 0);
            if (durations.length === 0) return svc.serviceDuration ? `${svc.serviceDuration} min` : '—';
            const max = Math.max(...durations);
            return `${max} min`;
        }
        return svc.serviceDuration ? `${svc.serviceDuration} min` : '—';
    };

    const filteredServices = services;

    if (showForm) return <ServiceEditor service={services.find(item => item._id === editingId)} categories={categories} subcategories={subcategories} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchData(); }} />;

    return (
        <div className="web-services">
            <div className="web-services-breadcrumb">Customer Management <span>›</span> <strong>Services</strong></div>
            <div className="web-services-heading">
                <div><h1>Web Services Management</h1><p>Manage the services available across your customer experience.</p></div>
                <button onClick={handleOpenCreate} className="web-services-create"><FaPlus /> Create New Service</button>
            </div>
            <section className="web-services-summary" aria-label="Service summary">
                {[['Total Services', 'total', 'All services'], ['Active', 'active', 'Currently available'], ['Inactive', 'inactive', 'Not visible to customers'], ['Drafts', 'draft', 'Pending publication']].map(([label, key, detail]) => (
                    <div key={key}><h2>{label}</h2><strong>{loading ? '—' : summary[key]}</strong><p>{detail}</p></div>
                ))}
            </section>

            <section className="web-services-filters" aria-label="Filter services">
                <div className="web-services-search"><input aria-label="Search services" placeholder="Search by service name" value={searchTerm} onChange={event => { setSearchTerm(event.target.value); setPage(1); }} /><span><FaSearch /></span></div>
                <label className="web-services-sort"><FaFilter /><select aria-label="Sort services" value={sortOrder} onChange={event => { setSortOrder(event.target.value); setPage(1); }}><option value="updated">Latest updated</option><option value="asc">Name (A–Z)</option><option value="desc">Name (Z–A)</option></select></label>
                <label>Category<select value={categoryFilter} onChange={event => { setCategoryFilter(event.target.value); setPage(1); }}><option value="">All</option>{categories.map(category => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
                <label>Status<select value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }}><option value="">All</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="draft">Draft</option></select></label>
                <button className="web-services-reset" onClick={() => { setSearchTerm(''); setCategoryFilter(''); setStatusFilter(''); setSortOrder('updated'); setPage(1); }}><FaTimes /> Reset</button>
            </section>
            {loading ? <ShimmerServiceTable rows={6} /> : (
                <div className="web-services-table-wrap">
                    <table className="web-services-table">
                        <thead><tr>{['Service', 'Category', 'Pricing', 'Duration', 'Status', 'Updated', 'Actions'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
                        <tbody>{filteredServices.map(svc => {
                            let description = svc.cardDescription || svc.shortDescription || '';
                            if (typeof description === 'string') { try { description = JSON.parse(description); } catch {} }
                            if (Array.isArray(description)) description = description.join(' ');
                            const serviceStatus = svc.status || (svc.isActive === false ? 'inactive' : 'active');
                            return <tr key={svc._id}>
                                <td><button className="web-services-name" onClick={() => handleOpenEdit(svc)}>{svc.name}</button><small className="web-services-id">{svc.serviceId || svc._id}</small><p className="web-services-description">{description}</p></td>
                                <td><span className="web-services-badge">{svc.category?.name || 'Uncategorized'}</span><div className="web-services-subcategory">{svc.subcategory?.name || '—'}</div></td>
                                <td><strong className="web-services-price">{getDisplayPrice(svc)}</strong><div className="web-services-price-detail">{svc.pricingType === 'quote' ? 'Get a Quote' : svc.pricingType === 'starting' || svc.hasVariants ? 'Starting From' : 'Fixed Price'}{!svc.hasVariants && svc.discountPercentage > 0 && <span> · {svc.discountPercentage}% off</span>}</div></td>
                                <td><span className="web-services-duration"><FaClock />{getDisplayDuration(svc)}</span></td>
                                <td><div className="web-services-badges"><span className={`web-services-status is-${serviceStatus}`}>• {serviceStatus}</span>{svc.isFeatured && <span className="web-services-status is-featured">• Featured</span>}</div></td>
                                <td className="web-services-date">{svc.updatedAt || svc.createdAt ? new Date(svc.updatedAt || svc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                                <td><div className="web-services-actions"><button onClick={() => handleOpenEdit(svc)} aria-label={`Edit ${svc.name}`} title="Edit"><FaEdit /></button><button onClick={() => handleDelete(svc._id)} aria-label={`Delete ${svc.name}`} title="Delete"><FaTrash /></button></div></td>
                            </tr>;
                        })}{!filteredServices.length && <tr><td colSpan={7} className="web-services-empty">No services found. Try adjusting the filters or create a new service.</td></tr>}</tbody>
                    </table>
                </div>
            )}
            {!loading && <div className="web-services-pagination"><Pagination {...pagination} page={page} limit={pageSize} onPageChange={setPage} onLimitChange={size => { setPageSize(size); setPage(1); }} /></div>}

        </div>
    );
};

export default SubcategoryManagement;
