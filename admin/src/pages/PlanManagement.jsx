import React, { useEffect, useState } from 'react';
import adminApi from '../services/adminApi';
import { FiChevronRight, FiEdit2, FiFilter, FiMoreVertical, FiPlus, FiSearch, FiX } from 'react-icons/fi';
import { Dropdown } from 'react-bootstrap';
import CatalogModal from '../components/CatalogModal';
import Pagination from '../components/Pagination';
import '../styles/CatalogManagement.css';
import '../styles/PlanManagement.css';
import { toast } from 'react-toastify';
import { useAdminAuth } from '../context/AdminAuthContext';

const EMPTY_FORM = {
    name: '', category: 'Residential', tagline: '', description: '', price: '', durationMonths: 12,
    featuresText: '', isFeatured: false, isActive: true
};

const PlanManagement = () => {
    const { can } = useAdminAuth();
    const canWritePlans = can('offers', 'write');
    const [plans, setPlans] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [tab, setTab] = useState('plans');
    const [form, setForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState('asc');
    const [billingCycle, setBillingCycle] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [pendingPlan, setPendingPlan] = useState(null);

    useEffect(() => { setPage(1); }, [search, sort, billingCycle, tab, limit]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [planResponse, purchaseResponse] = await Promise.all([
                adminApi.getPlans(), adminApi.getPlanPurchases()
            ]);
            setPlans(planResponse.data?.plans || []);
            setPurchases(purchaseResponse.data?.planPurchases || []);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not load plan data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const startCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setShowForm(true);
    };

    const startEdit = (plan) => {
        setEditingId(plan._id);
        setForm({
            name: plan.name,
            category: plan.category || 'Residential',
            tagline: plan.tagline || '',
            description: plan.description || '',
            price: plan.price,
            durationMonths: plan.durationMonths,
            featuresText: (plan.features || []).join('\n'),
            isFeatured: plan.isFeatured,
            isActive: plan.isActive
        });
        setShowForm(true);
    };

    const savePlan = async (event) => {
        event.preventDefault();
        setSaving(true);
        const payload = {
            ...form,
            price: Number(form.price),
            durationMonths: Number(form.durationMonths),
            features: form.featuresText.split('\n').map(item => item.trim()).filter(Boolean)
        };
        try {
            if (editingId) await adminApi.updatePlan(editingId, payload);
            else await adminApi.createPlan(payload);
            toast.success(editingId ? 'Plan updated.' : 'Plan created.');
            setShowForm(false);
            await fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not save this plan.');
        } finally {
            setSaving(false);
        }
    };

    const togglePlan = async (plan) => {
        setPendingPlan(plan._id);
        try {
            await adminApi.updatePlanStatus(plan._id, !plan.isActive);
            await fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not update plan status.');
        } finally { setPendingPlan(null); }
    };

    const cycleLabel = months => Number(months) === 1 ? 'Monthly' : Number(months) === 3 ? 'Quarterly' : Number(months) === 12 ? 'Annual' : `${months} months`;
    const priceSuffix = months => Number(months) === 1 ? '/mo' : Number(months) === 3 ? '/qtr' : Number(months) === 12 ? '/yr' : `/${months} mo`;
    const money = item => new Intl.NumberFormat('en-US', { style: 'currency', currency: item.currency?.toUpperCase() || 'USD', maximumFractionDigits: 2 }).format(item.price);
    const activePurchases = purchases.filter(item => item.status === 'active' && (!item.expiresAt || new Date(item.expiresAt) > new Date()));
    const subscriberCount = plan => new Set(activePurchases.filter(item => (item.plan?._id || item.plan) === plan._id).map(item => item.user?._id || item.user || item._id)).size;
    const filtered = (tab === 'plans' ? plans : purchases).filter(item => {
        const text = tab === 'plans' ? `${item.name} ${item.category} ${item.tagline} ${item.description}` : `${item.user?.name || ''} ${item.user?.email || ''} ${item.planName}`;
        return text.toLowerCase().includes(search.toLowerCase()) && (!billingCycle || (billingCycle === 'other' ? ![1, 3, 12].includes(Number(item.durationMonths)) : Number(item.durationMonths) === Number(billingCycle)));
    }).sort((a, b) => {
        const first = tab === 'plans' ? a.name : a.user?.name || a.planName;
        const second = tab === 'plans' ? b.name : b.user?.name || b.planName;
        return sort === 'asc' ? first.localeCompare(second) : second.localeCompare(first);
    });
    const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
    const currentPage = Math.min(page, totalPages);
    const visible = filtered.slice((currentPage - 1) * limit, currentPage * limit);
    const field = (key, value) => setForm(previous => ({ ...previous, [key]: value }));

    return (
        <section className="catalog-management membership-management">
            <div className="catalog-breadcrumb">Customer Management <FiChevronRight /><span>Membership</span></div>
            <h1>Membership</h1>
            <p className="catalog-description">Manage membership plans, customer subscriptions, benefits, renewals and cancellations.</p>
            <div className="catalog-filters membership-filters">
                <div className="catalog-search"><input type="search" aria-label="Search membership" placeholder="Search by plan or customer" value={search} onChange={event => setSearch(event.target.value)} /><span className="catalog-search-icon"><FiSearch /></span></div>
                <div className="catalog-sort"><FiFilter /><select aria-label="Sort membership" value={sort} onChange={event => setSort(event.target.value)}><option value="asc">Sort: A–Z</option><option value="desc">Sort: Z–A</option></select></div>
                <label>Billing Cycle<select value={billingCycle} onChange={event => setBillingCycle(event.target.value)}><option value="">All</option><option value="1">Monthly</option><option value="3">Quarterly</option><option value="12">Annual</option><option value="other">Other</option></select></label>
                <button type="button" className="catalog-reset" onClick={() => { setSearch(''); setSort('asc'); setBillingCycle(''); setPage(1); }}><FiX />Reset</button>
            </div>
            <div className="membership-toolbar">
                <nav className="membership-tabs" aria-label="Membership sections"><button type="button" className={tab === 'plans' ? 'active' : ''} aria-pressed={tab === 'plans'} onClick={() => setTab('plans')}>Plans</button><button type="button" className={tab === 'purchases' ? 'active' : ''} aria-pressed={tab === 'purchases'} onClick={() => setTab('purchases')}>Subscribers</button></nav>
                {tab === 'plans' && canWritePlans && <button type="button" className="catalog-create" onClick={startCreate}><FiPlus />Create New Plan</button>}
            </div>
            {showForm && <CatalogModal dialogClassName="membership-plan-modal" title={editingId ? 'Edit plan' : 'Create plan'} onClose={() => setShowForm(false)} busy={saving}>
                <form onSubmit={savePlan}>
                    <div className="catalog-modal-grid">
                        <label className="catalog-modal-field"><span>Plan name</span><input autoFocus required maxLength={80} placeholder="e.g. Business" value={form.name} onChange={event => field('name', event.target.value)} /></label>
                        <label className="catalog-modal-field"><span>Plan category</span><select required value={form.category} onChange={event => field('category', event.target.value)}><option>Residential</option><option>Business</option></select></label>
                    </div>
                    <label className="catalog-modal-field"><span>Tagline</span><input maxLength={160} placeholder="A short introduction to this plan" value={form.tagline} onChange={event => field('tagline', event.target.value)} /></label>
                    <label className="catalog-modal-field"><span>Description</span><textarea rows={2} maxLength={500} placeholder="What does this membership cover?" value={form.description} onChange={event => field('description', event.target.value)} /></label>
                    <div className="catalog-modal-grid">
                        <label className="catalog-modal-field"><span>Price ({plans[0]?.currency?.toUpperCase() || 'USD'})</span><input required type="number" min="0.01" step="0.01" placeholder="0.00" value={form.price} onChange={event => field('price', event.target.value)} /></label>
                        <label className="catalog-modal-field"><span>Billing cycle (months)</span><input required type="number" min="1" max="120" step="1" list="plan-billing-cycles" value={form.durationMonths} onChange={event => field('durationMonths', event.target.value)} /><datalist id="plan-billing-cycles"><option value="1">Monthly</option><option value="3">Quarterly</option><option value="12">Annual</option></datalist></label>
                    </div>
                    <label className="catalog-modal-field"><span>Benefits (one per line)</span><textarea rows={3} placeholder={'20% off services\n5 free visits'} value={form.featuresText} onChange={event => field('featuresText', event.target.value)} /></label>
                    <fieldset className="catalog-modal-status"><legend>Status</legend><div>{[true, false].map(active => <label key={String(active)} className={form.isActive === active ? 'selected' : ''}><input type="radio" name="plan-status" checked={form.isActive === active} onChange={() => field('isActive', active)} />{active ? 'Active' : 'Inactive'}</label>)}</div></fieldset>
                    <label className="membership-featured"><input type="checkbox" checked={form.isFeatured} onChange={event => field('isFeatured', event.target.checked)} />Feature this plan</label>
                    <div className="catalog-modal-footer"><button type="button" className="catalog-modal-cancel" disabled={saving} onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="catalog-modal-save" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create plan'}</button></div>
                </form>
            </CatalogModal>}
            <div className="membership-table-container" aria-busy={loading}>
                <table className="membership-table">
                    <thead>{tab === 'plans' ? <tr><th>Plan name</th><th>Price</th><th>Billing<br />cycle</th><th>Subscribers</th><th>Status</th>{canWritePlans && <th>Actions</th>}</tr> : <tr><th>Customer</th><th>Plan</th><th>Amount</th><th>Payment status</th><th>Purchased</th><th>Expires</th></tr>}</thead>
                    <tbody>{loading ? <tr><td colSpan={tab === 'plans' ? (canWritePlans ? 6 : 5) : 6} className="membership-empty">Loading membership data…</td></tr> : tab === 'plans' ? visible.map(plan => {
                        return <tr key={plan._id}>
                            <td><strong className="membership-name">{plan.name}</strong><span className="membership-summary" title={plan.tagline || plan.description}>{plan.tagline || plan.description || plan.category}</span></td>
                            <td className="membership-price"><strong>{money(plan)}</strong><span>{priceSuffix(plan.durationMonths)}</span></td>
                            <td>{cycleLabel(plan.durationMonths)}</td>
                            <td><strong>{subscriberCount(plan)}</strong><span className="membership-muted"> active</span></td>
                            <td><span className={`membership-status ${plan.isActive ? 'active' : 'inactive'}`}>• {plan.isActive ? 'Active' : 'Inactive'}</span></td>
                            {canWritePlans && <td><div className="membership-actions"><button type="button" className="membership-edit" onClick={() => startEdit(plan)}><FiEdit2 />Edit</button><Dropdown><Dropdown.Toggle variant="link" className="membership-more" aria-label={`More actions for ${plan.name}`} disabled={pendingPlan === plan._id}><FiMoreVertical /></Dropdown.Toggle><Dropdown.Menu><Dropdown.Item onClick={() => togglePlan(plan)}>{plan.isActive ? 'Deactivate plan' : 'Activate plan'}</Dropdown.Item></Dropdown.Menu></Dropdown></div></td>}
                        </tr>;
                    }) : visible.map(purchase => <tr key={purchase._id}>
                        <td><strong>{purchase.user?.name || 'Customer unavailable'}</strong><span className="membership-summary">{purchase.user?.email || ''}</span></td>
                        <td><strong>{purchase.planName}</strong><span className="membership-summary">{purchase.category || 'Residential'} · {cycleLabel(purchase.durationMonths)}</span></td>
                        <td className="membership-price"><strong>{money(purchase)}</strong></td>
                        <td><span className={`membership-status ${purchase.status === 'active' ? 'active' : 'inactive'}`}>{purchase.status}</span></td>
                        <td>{purchase.paidAt ? new Date(purchase.paidAt).toLocaleDateString() : 'Not paid'}</td>
                        <td>{purchase.expiresAt ? new Date(purchase.expiresAt).toLocaleDateString() : '—'}</td>
                    </tr>)}{!loading && visible.length === 0 && <tr><td colSpan={tab === 'plans' ? (canWritePlans ? 6 : 5) : 6} className="membership-empty">No {tab === 'plans' ? 'plans' : 'subscribers'} found.</td></tr>}</tbody>
                </table>
            </div>
            {!loading && <div className="catalog-pagination"><Pagination page={currentPage} totalPages={totalPages} total={filtered.length} limit={limit} onPageChange={setPage} onLimitChange={setLimit} /></div>}
        </section>
    );
};

export default PlanManagement;
