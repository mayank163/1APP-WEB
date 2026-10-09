import '../styles/Plans.css';
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { FaCheckCircle, FaShieldAlt, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { AuthContext } from '../context/AuthContext';
import planService from '../services/planService';

const currencyLabel = (currency) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase(), currencyDisplay: 'narrowSymbol' }); }
    catch { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }); }
};

const readPendingPurchase = () => {
    try { return JSON.parse(sessionStorage.getItem('1app_pending_plan_purchase') || 'null'); }
    catch { return null; }
};

const PlanPaymentForm = ({ purchase, onPaid, onCancel }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [processing, setProcessing] = useState(false);
    const [verifiedPaymentId, setVerifiedPaymentId] = useState('');
    const [verificationError, setVerificationError] = useState('');

    const verifyPayment = async (paymentIntentId) => {
        setProcessing(true);
        setVerificationError('');
        try {
            await planService.verifyPurchase(purchase.planPurchase._id, paymentIntentId);
            sessionStorage.removeItem('1app_pending_plan_purchase');
            onPaid();
        } catch (error) {
            setVerifiedPaymentId(paymentIntentId);
            setVerificationError(error.response?.data?.message || 'Payment completed. Retry verification to activate your plan.');
        } finally {
            setProcessing(false);
        }
    };

    useEffect(() => {
        if (!stripe) return undefined;
        let mounted = true;
        const reconcileRedirectedPayment = async () => {
            try {
                const { paymentIntent } = await stripe.retrievePaymentIntent(purchase.paymentOrder.clientSecret);
                if (!mounted || paymentIntent?.status !== 'succeeded') return;
                setProcessing(true);
                await planService.verifyPurchase(purchase.planPurchase._id, paymentIntent.id);
                sessionStorage.removeItem('1app_pending_plan_purchase');
                if (mounted) onPaid();
            } catch (error) {
                if (mounted) {
                    setVerifiedPaymentId(purchase.paymentOrder.id);
                    setVerificationError(error.response?.data?.message || 'Payment completed. Retry verification to activate your plan.');
                }
            } finally {
                if (mounted) setProcessing(false);
            }
        };
        reconcileRedirectedPayment();
        return () => { mounted = false; };
    }, [stripe, purchase.paymentOrder.clientSecret, purchase.paymentOrder.id, purchase.planPurchase._id, onPaid]);

    const submitPayment = async (event) => {
        event.preventDefault();
        if (!stripe || !elements) return;
        setProcessing(true);
        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                confirmParams: { return_url: `${window.location.origin}/` },
                redirect: 'if_required'
            });
            if (error) {
                toast.error(error.message || 'Payment was not completed.');
                return;
            }
            if (!paymentIntent || paymentIntent.status !== 'succeeded') {
                toast.error('Payment was not completed.');
                return;
            }
            await verifyPayment(paymentIntent.id);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || 'Payment failed.');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <form onSubmit={submitPayment} className="p-3 p-md-4">
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                    <div className="small text-muted">Secure checkout</div>
                    <h3 id="plan-checkout-title" className="h5 fw-bold mb-0">{purchase.planPurchase.planName}</h3>
                </div>
                <button type="button" title="Close checkout" onClick={onCancel} className="btn btn-sm btn-outline-secondary"><FaTimes /></button>
            </div>
            <div className="border rounded p-3 mb-3">
                <PaymentElement options={{ layout: 'tabs', wallets: { applePay: 'never', googlePay: 'never' } }} />
            </div>
            {verificationError && (
                <div className="alert alert-warning small">
                    {verificationError}
                    {verifiedPaymentId && <button type="button" className="btn btn-sm btn-link" disabled={processing} onClick={() => verifyPayment(verifiedPaymentId)}>Retry verification</button>}
                </div>
            )}
            <button type="submit" disabled={!stripe || !elements || processing} className="btn btn-dark w-100 py-3 fw-bold">
                {processing ? 'Processing...' : `Pay ${currencyLabel(purchase.paymentOrder.currency).format(purchase.planPurchase.price)}`}
            </button>
            <div className="text-center small text-muted mt-3"><FaShieldAlt className="me-1" /> Payment processed securely by Stripe</div>
        </form>
    );
};

const Plans = () => {
    const { isAuthenticated, user } = React.useContext(AuthContext);
    const navigate = useNavigate();
    const [plans, setPlans] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('Residential');
    const [selectedDurationYears, setSelectedDurationYears] = useState(1);
    const [loading, setLoading] = useState(true);
    const [activePlanPurchase, setActivePlanPurchase] = useState(null);
    const [loadingActivePlan, setLoadingActivePlan] = useState(true);
    const [checkout, setCheckout] = useState(readPendingPurchase);
    const [stripePromise, setStripePromise] = useState(() => {
        const pending = readPendingPurchase();
        return pending?.paymentOrder?.publishableKey ? loadStripe(pending.paymentOrder.publishableKey) : null;
    });
    const [startingId, setStartingId] = useState('');
    useEffect(() => {
        let isCurrentRequest = true;
        setLoading(true);
        planService.getPlans({ category: selectedCategory, durationYears: selectedDurationYears })
            .then(response => {
                if (isCurrentRequest) setPlans(response.data?.plans || []);
            })
            .catch(error => {
                if (isCurrentRequest) toast.error(error.response?.data?.message || 'Could not load plans.');
            })
            .finally(() => {
                if (isCurrentRequest) setLoading(false);
            });
        return () => { isCurrentRequest = false; };
    }, [selectedCategory, selectedDurationYears]);

    useEffect(() => {
        let isCurrentRequest = true;
        if (!isAuthenticated || user?.role !== 'user') {
            setActivePlanPurchase(null);
            setLoadingActivePlan(false);
            return () => { isCurrentRequest = false; };
        }

        setLoadingActivePlan(true);
        planService.getMyPurchases()
            .then(response => {
                if (!isCurrentRequest) return;
                const currentPurchase = (response.data?.planPurchases || []).find(purchase => (
                    purchase.status === 'active' && purchase.expiresAt && new Date(purchase.expiresAt) > new Date()
                ));
                setActivePlanPurchase(currentPurchase || null);
            })
            .catch(() => {
                if (isCurrentRequest) setActivePlanPurchase(null);
            })
            .finally(() => {
                if (isCurrentRequest) setLoadingActivePlan(false);
            });
        return () => { isCurrentRequest = false; };
    }, [isAuthenticated, user?.role]);

    const startCheckout = async (plan) => {
        if (!isAuthenticated || user?.role !== 'user') {
            toast.info('Sign in with a customer account to purchase a plan.');
            navigate('/login');
            return;
        }
        setStartingId(plan._id);
        try {
            const response = await planService.createPurchase(plan._id);
            const purchase = response.data;
            sessionStorage.setItem('1app_pending_plan_purchase', JSON.stringify(purchase));
            setStripePromise(loadStripe(purchase.paymentOrder.publishableKey));
            setCheckout(purchase);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not start plan checkout.');
        } finally {
            setStartingId('');
        }
    };

    const closeCheckout = () => {
        sessionStorage.removeItem('1app_pending_plan_purchase');
        setCheckout(null);
        setStripePromise(null);
    };

    const handlePaid = useCallback(() => {
        setCheckout(null);
        toast.success('Plan purchased and added to your profile.');
        navigate('/profile');
    }, [navigate]);

    return (
        <section id="plans" className="plans-page py-5">

            <div className="container">
                <div className="text-center mb-5">
                    <h2 className="h1 fw-bold mb-2">Choose Your Plan</h2>
                    <p className="text-secondary mb-0">One secure payment. Your plan and coverage details stay in your profile.</p>
                </div>

                <div className="d-flex flex-column align-items-center gap-3 mb-5">
                    <div className="btn-group" role="group" aria-label="Plan category">
                        {['Residential', 'Business'].map(category => (
                            <button
                                key={category}
                                type="button"
                                className="btn plan-choice px-4 py-2"
                                aria-pressed={selectedCategory === category}
                                onClick={() => setSelectedCategory(category)}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                    <div className="btn-group" role="group" aria-label="Plan duration">
                        {[1, 2, 3].map(years => (
                            <button
                                key={years}
                                type="button"
                                className="btn plan-choice px-3 px-sm-4 py-2"
                                aria-pressed={selectedDurationYears === years}
                                onClick={() => setSelectedDurationYears(years)}
                            >
                                {years} {years === 1 ? 'Year' : 'Years'}
                            </button>
                        ))}
                    </div>
                </div>

                {checkout && stripePromise && createPortal(
                    <div className="plan-checkout-overlay" onMouseDown={event => { if (event.target === event.currentTarget) closeCheckout(); }}>
                        <div className="plan-checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="plan-checkout-title">
                            <Elements stripe={stripePromise} options={{ clientSecret: checkout.paymentOrder.clientSecret }}>
                                <PlanPaymentForm purchase={checkout} onPaid={handlePaid} onCancel={closeCheckout} />
                            </Elements>
                        </div>
                    </div>,
                    document.body
                )}

                {loading ? <div className="text-center py-5">Loading available plans...</div> : (
                    <section aria-live="polite">

                        <div className="row g-4 justify-content-center">
                            {plans.map(plan => (
                                <div key={plan._id} className="col-12 col-md-6 col-xl-4">
                                    <article className={`plan-card p-4 p-lg-5 d-flex flex-column ${plan.isFeatured ? 'featured' : ''}`}>
                                        {plan.isFeatured && <span className="badge text-bg-dark align-self-start mb-2">Best deal</span>}
                                        <h3 className="h4 fw-bold mb-2">{plan.name}</h3>
                                        {plan.tagline && <p className="small mb-2">{plan.tagline}</p>}
                                        {plan.description && <p className="mb-4 text-secondary">{plan.description}</p>}
                                        <div className="d-flex align-items-end gap-2 mb-4">
                                            <div className="plan-price">{currencyLabel(plan.currency || 'usd').format(plan.price)}</div>
                                            <span className="small text-secondary pb-1">for {plan.durationMonths} months</span>
                                        </div>
                                        <div className="small fw-bold mb-2">This includes:</div>
                                        <ul className="list-unstyled d-flex flex-column gap-2 mb-4">
                                            {(plan.features || []).map((feature, index) => (
                                                <li key={`${plan._id}-${index}`} className="d-flex align-items-start gap-2"><FaCheckCircle className="text-success mt-1 flex-shrink-0" size={14} /><span>{feature}</span></li>
                                            ))}
                                            {!plan.features?.length && <li className="text-secondary">Plan support for {plan.durationMonths} months.</li>}
                                        </ul>
                                        <button
                                            type="button"
                                            className="btn btn-dark fw-bold py-3 mt-auto"
                                            disabled={Boolean(startingId) || loadingActivePlan || String(activePlanPurchase?.plan) === String(plan._id)}
                                            onClick={() => startCheckout(plan)}
                                        >
                                            {String(activePlanPurchase?.plan) === String(plan._id) ? 'Current Plan' : startingId === plan._id ? 'Preparing checkout...' : 'Subscribe Now'}
                                        </button>
                                    </article>
                                </div>
                            ))}
                            {!plans.length && <div className="col-12 text-center text-secondary py-3">No {selectedCategory.toLowerCase()} plans are available for {selectedDurationYears} {selectedDurationYears === 1 ? 'year' : 'years'} yet.</div>}
                        </div>
                    </section>
                )}
            </div>
        </section>
    );
};

export default Plans;