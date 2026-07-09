import React, { useState } from 'react';
import { FaTag, FaPlus, FaCheckCircle, FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';

const OfferManagement = () => {
    const [offers, setOffers] = useState([
        { code: '1APP10', discount: '10% OFF', description: 'Applicable on wiring and cabling services', isActive: true },
        { code: 'ELECTRO20', discount: '20% OFF', description: 'Discount on Smart DB distributions upgrades', isActive: true },
        { code: 'SAFETYFIRST', discount: 'Flat ₹200 OFF', description: 'Applicable on home inspections', isActive: true }
    ]);
    const [showForm, setShowForm] = useState(false);
    const [code, setCode] = useState('');
    const [discount, setDiscount] = useState('');
    const [description, setDescription] = useState('');

    const handleCreateOffer = (e) => {
        e.preventDefault();
        if (!code || !discount || !description) {
            toast.error('All fields are required!');
            return;
        }

        const newOffer = {
            code: code.toUpperCase().trim(),
            discount,
            description,
            isActive: true
        };

        setOffers([...offers, newOffer]);
        toast.success('Mock Coupon Created Successfully!');
        setShowForm(false);
        setCode('');
        setDiscount('');
        setDescription('');
    };

    const handleDeleteOffer = (codeToDelete) => {
        setOffers(offers.filter(o => o.code !== codeToDelete));
        toast.info('Coupon deactivated.');
    };

    return (
        <div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="fw-extrabold text-dark mb-1">Offers & Coupons</h1>
                    <p className="text-muted">Configure active promotional coupons, service codes, and discount campaigns.</p>
                </div>
                {!showForm && (
                    <button onClick={() => setShowForm(true)} className="btn btn-dark fw-bold d-flex align-items-center gap-2 px-4 shadow-sm">
                        <FaPlus />
                        <span>Create Coupon</span>
                    </button>
                )}
            </div>

            {showForm && (
                <div className="card border-0 shadow-sm rounded-3 bg-white p-4 mb-4">
                    <h5 className="fw-bold mb-4 border-bottom pb-2">Generate New Promotional Code</h5>
                    <form onSubmit={handleCreateOffer}>
                        <div className="row g-3 mb-4">
                            <div className="col-md-4">
                                <label className="form-label text-muted small fw-bold">Coupon Code</label>
                                <input 
                                    type="text" 
                                    required 
                                    className="form-control bg-light border-0" 
                                    placeholder="1APP30"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                />
                            </div>
                            <div className="col-md-4">
                                <label className="form-label text-muted small fw-bold">Discount Value</label>
                                <input 
                                    type="text" 
                                    required 
                                    className="form-control bg-light border-0" 
                                    placeholder="30% OFF / Flat ₹300 OFF"
                                    value={discount}
                                    onChange={(e) => setDiscount(e.target.value)}
                                />
                            </div>
                            <div className="col-md-4">
                                <label className="form-label text-muted small fw-bold">Applicability / Scope</label>
                                <input 
                                    type="text" 
                                    required 
                                    className="form-control bg-light border-0" 
                                    placeholder="On all orders above ₹999"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="d-flex gap-2 justify-content-end">
                            <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline-secondary px-4 py-2">
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-dark fw-bold px-4 py-2 shadow-sm">
                                Create Coupon
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="row g-4">
                {offers.map((offer, idx) => (
                    <div key={idx} className="col-md-4">
                        <div className="card border-0 shadow-sm rounded-3 p-4 bg-white hover-shadow transition-all border-top border-dark border-3">
                            <div className="d-flex align-items-center justify-content-between mb-3">
                                <span className="badge bg-light text-primary border font-monospace px-3 py-1.5 fs-6 fw-bold">
                                    {offer.code}
                                </span>
                                <span className="text-success d-flex align-items-center gap-1 small fw-bold">
                                    <FaCheckCircle />
                                    <span>Active</span>
                                </span>
                            </div>
                            <h4 className="fw-bold text-dark font-monospace mb-1">{offer.discount}</h4>
                            <p className="text-muted small mb-3">{offer.description}</p>
                            
                            <button 
                                onClick={() => handleDeleteOffer(offer.code)}
                                className="btn btn-sm btn-outline-danger w-100 d-flex align-items-center justify-content-center gap-2 mt-2"
                            >
                                <FaTrash size={12} />
                                <span>Deactivate Coupon</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default OfferManagement;
