import React, { useEffect, useState } from 'react';
import adminApi from '../services/adminApi';
import { FaPlus, FaEdit, FaToggleOn, FaToggleOff } from 'react-icons/fa';
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
        try {
            await adminApi.updatePlanStatus(plan._id, !plan.isActive);
            await fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not update plan status.');
        }
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
                <div>
                    <h1 className="fw-bold text-dark mb-1">Plans</h1>
                    <p className="text-muted mb-0">Manage the customer catalog and completed plan payments.</p>
                </div>
                {tab === 'plans' && !showForm && canWritePlans && (
                    <button type="button" onClick={startCreate} className="btn btn-brand fw-bold d-flex align-items-center gap-2">
                        <FaPlus /> Add Plan
                    </button>
                )}
            </div>

            <div className="btn-group mb-4" role="group" aria-label="Plan sections">
                <button type="button" className={`btn ${tab === 'plans' ? 'btn-dark' : 'btn-outline-secondary'}`} onClick={() => setTab('plans')}>Catalog</button>
                <button type="button" className={`btn ${tab === 'purchases' ? 'btn-dark' : 'btn-outline-secondary'}`} onClick={() => setTab('purchases')}>Purchases ({purchases.length})</button>
            </div>

            {showForm && tab === 'plans' && (
                <form onSubmit={savePlan} className="card border-0 shadow-sm p-4 mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5 className="fw-bold mb-0">{editingId ? 'Edit Plan' : 'Create Plan'}</h5>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowForm(false)}>Close</button>
                    </div>
                    <div className="row g-3">
                        <div className="col-md-6">
                            <label className="form-label">Plan name *</label>
                            <input required maxLength="80" className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label">Plan category *</label>
                            <select required className="form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                                <option value="Residential">Residential</option>
                                <option value="Business">Business</option>
                            </select>
                        </div>
                        <div className="col-md-6">
                            <label className="form-label">Short tagline</label>
                            <input maxLength="160" className="form-control" value={form.tagline} onChange={e => setForm({ ...form, tagline: e.target.value })} />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label">Price *</label>
                            <input required type="number" min="0.01" step="0.01" className="form-control" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
                        </div>
                        <div className="col-md-6">
                            <label className="form-label">Duration (months) *</label>
                            <input required type="number" min="1" max="120" step="1" className="form-control" value={form.durationMonths} onChange={e => setForm({ ...form, durationMonths: e.target.value })} />
                        </div>
                        <div className="col-12">
                            <label className="form-label">Description</label>
                            <textarea rows="2" maxLength="500" className="form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                        </div>
                        <div className="col-12">
                            <label className="form-label">Included features (one per line)</label>
                            <textarea rows="5" className="form-control" value={form.featuresText} onChange={e => setForm({ ...form, featuresText: e.target.value })} />
                        </div>
                        <div className="col-md-6 form-check ms-2">
                            <input id="plan-featured" type="checkbox" className="form-check-input" checked={form.isFeatured} onChange={e => setForm({ ...form, isFeatured: e.target.checked })} />
                            <label htmlFor="plan-featured" className="form-check-label">Feature this plan</label>
                        </div>
                        <div className="col-md-6 form-check ms-2">
                            <input id="plan-active" type="checkbox" className="form-check-input" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
                            <label htmlFor="plan-active" className="form-check-label">Available to customers</label>
                        </div>
                    </div>
                    <div className="d-flex gap-2 mt-4">
                        <button type="submit" disabled={saving} className="btn btn-dark px-4">{saving ? 'Saving...' : 'Save Plan'}</button>
                        <button type="button" className="btn btn-outline-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                    </div>
                </form>
            )}

            <div className="card border-0 shadow-sm p-3 p-md-4">
                {loading ? <div className="text-muted py-4">Loading...</div> : tab === 'plans' ? (
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light"><tr><th>Plan</th><th>Category</th><th>Duration</th><th>Price</th><th>Customers see</th><th>Status</th>{canWritePlans && <th>Actions</th>}</tr></thead>
                            <tbody>
                                {plans.map(plan => (
                                    <tr key={plan._id}>
                                        <td><strong>{plan.name}</strong>{plan.isFeatured && <span className="badge bg-warning text-dark ms-2">Featured</span>}<div className="small text-muted">{plan.tagline || plan.description}</div></td>
                                        <td>{plan.category || 'Residential'}</td>
                                        <td>{plan.durationMonths} months</td>
                                        <td>{new Intl.NumberFormat(undefined, { style: 'currency', currency: plan.currency?.toUpperCase() || 'USD' }).format(plan.price)}</td>
                                        <td>{plan.isActive ? 'Listed' : 'Hidden'}</td>
                                        <td><span className={`badge ${plan.isActive ? 'bg-success' : 'bg-secondary'}`}>{plan.isActive ? 'Active' : 'Inactive'}</span></td>
                                        {canWritePlans && <td className="text-nowrap">
                                            <button type="button" title="Edit plan" className="btn btn-sm btn-outline-primary me-2" onClick={() => startEdit(plan)}><FaEdit /></button>
                                            <button type="button" title={plan.isActive ? 'Hide plan' : 'Publish plan'} className="btn btn-sm btn-outline-secondary" onClick={() => togglePlan(plan)}>{plan.isActive ? <FaToggleOn /> : <FaToggleOff />}</button>
                                        </td>}
                                    </tr>
                                ))}
                                {!plans.length && <tr><td colSpan={canWritePlans ? 7 : 6} className="text-center text-muted py-5">No plans created yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0">
                            <thead className="table-light"><tr><th>Customer</th><th>Plan</th><th>Amount</th><th>Payment status</th><th>Purchased</th><th>Expires</th></tr></thead>
                            <tbody>
                                {purchases.map(purchase => (
                                    <tr key={purchase._id}>
                                        <td>{purchase.user?.name || 'Customer unavailable'}<div className="small text-muted">{purchase.user?.email || ''}</div></td>
                                        <td>{purchase.planName}<div className="small text-muted">{purchase.category || 'Residential'} · {purchase.durationMonths} months</div></td>
                                        <td>{new Intl.NumberFormat(undefined, { style: 'currency', currency: purchase.currency?.toUpperCase() || 'USD' }).format(purchase.price)}</td>
                                        <td><span className={`badge ${purchase.status === 'active' ? 'bg-success' : purchase.status === 'expired' ? 'bg-secondary' : 'bg-warning text-dark'}`}>{purchase.status}</span></td>
                                        <td>{purchase.paidAt ? new Date(purchase.paidAt).toLocaleDateString() : 'Not paid'}</td>
                                        <td>{purchase.expiresAt ? new Date(purchase.expiresAt).toLocaleDateString() : '—'}</td>
                                    </tr>
                                ))}
                                {!purchases.length && <tr><td colSpan="6" className="text-center text-muted py-5">No plan purchases yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlanManagement;