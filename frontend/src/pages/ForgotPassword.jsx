import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaEnvelope, FaPhone, FaArrowLeft } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from 'axios';
import { ResetAuthPanel } from './AuthPanel';


const ForgotPassword = () => {
    const navigate = useNavigate();
    const [useEmail, setUseEmail] = useState(true);
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.post(process.env.REACT_APP_API_URL + '/auth/forgot-password', { identifier });
            if (res.data.success) {
                toast.success(res.data.message);
                navigate('/verify-otp', {
                    state: { phone: res.data.phone, identifier },
                });
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh' }}>
            {/* Left - Illustration */}
            <ResetAuthPanel />
            {/* Right - form */}  
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 64px', background: '#fff' }}>
                <div style={{ maxWidth: 380, width: '100%', margin: '0 auto' }}>
                    <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#555', textDecoration: 'none', fontSize: '0.88rem', marginBottom: 32 }}>
                        <FaArrowLeft size={12} /> Back to Login
                    </Link>

                    <div style={{ marginBottom: 28 }}>
                        <h2 style={{ fontWeight: 800, fontSize: '1.8rem', marginBottom: 8 }}>
                            Forgot <span style={{ color: '#2d7a3a' }}>Password?</span>
                        </h2>
                        <p style={{ color: '#777', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            No worries! Enter your {useEmail ? 'email address' : 'phone number'} and we'll send you a link to reset your password.
                        </p>
                        <div style={{ width: 40, height: 3, background: '#2d7a3a', marginTop: 12 }} />
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: 8 }}>
                            <label style={{ fontWeight: 700, fontSize: '0.85rem', display: 'block', marginBottom: 6 }}>
                                {useEmail ? 'Email Address' : 'Phone Number'}
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #ddd', borderRadius: 8, padding: '10px 14px', gap: 10 }}>
                                {useEmail ? <FaEnvelope color="#888" size={14} /> : <FaPhone color="#888" size={14} />}
                                <input
                                    type={useEmail ? 'email' : 'tel'}
                                    required
                                    placeholder={useEmail ? 'name@example.com' : '+91 98765 43210'}
                                    value={identifier}
                                    onChange={e => setIdentifier(e.target.value)}
                                    style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.95rem' }}
                                />
                            </div>
                            <div style={{ textAlign: 'right', marginTop: 4 }}>
                                <button type="button" onClick={() => { setUseEmail(!useEmail); setIdentifier(''); }}
                                    style={{ background: 'none', border: 'none', color: '#2d7a3a', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                                    {useEmail ? 'Use Phone Number' : 'Use Email'}
                                </button>
                            </div>
                        </div>

                        <button type="submit" disabled={loading}
                            style={{ width: '100%', background: '#2d7a3a', color: '#fff', border: 'none', borderRadius: 8, padding: '13px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            {loading ? 'Sending...' : 'Send Reset Link'} <span style={{ fontSize: '1.1rem' }}>→</span>
                        </button>
                    </form>

                    <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: 10 }}>
                        <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
                        <span style={{ color: '#aaa', fontSize: '0.8rem', fontWeight: 600 }}>OR</span>
                        <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
                    </div>

                    <p style={{ textAlign: 'center', fontSize: '0.88rem', color: '#555' }}>
                        Remember your Password?{' '}
                        <Link to="/login" style={{ color: '#2d7a3a', fontWeight: 700, textDecoration: 'none' }}>Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

const ForgotIllustration = () => (
    <div style={{ background: '#f5ede0', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 48, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 32, right: 32, display: 'grid', gridTemplateColumns: 'repeat(5,8px)', gap: 6 }}>
            {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#3a7d44', opacity: 0.5 }} />
            ))}
        </div>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
            {/* Lock icons row */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 24 }}>
                {['📧', '🔒', '🔄'].map((icon, i) => (
                    <div key={i} style={{ width: 56, height: 56, background: '#fff', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                        {icon}
                    </div>
                ))}
            </div>
            {/* Phone mockup placeholder */}
            <div style={{ background: '#fff', borderRadius: 32, padding: '32px 24px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', display: 'inline-block', minWidth: 200 }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🏠</div>
                <div style={{ color: '#2d7a3a', fontWeight: 800, fontSize: '1.2rem' }}>OneApp</div>
                <div style={{ color: '#888', fontSize: '0.8rem' }}>All Services, One App</div>
                <div style={{ marginTop: 20, background: '#f5f5f5', borderRadius: 12, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.5rem' }}>🔒</span>
                    <span style={{ fontSize: '1.2rem', letterSpacing: 4, color: '#555' }}>* * * *</span>
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 24 }}>
                <div style={{ width: 48, height: 48, background: '#2d7a3a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>✓</div>
                <div style={{ width: 48, height: 48, background: '#2d7a3a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>✓</div>
            </div>
        </div>
    </div>
);

export default ForgotPassword;
