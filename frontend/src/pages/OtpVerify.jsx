import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaArrowLeft } from 'react-icons/fa';
import { ResetAuthPanel } from './AuthPanel';

const OtpVerify = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { phone, identifier } = location.state || {};
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const inputs = useRef([]);

    useEffect(() => {
        if (!phone) navigate('/forgot-password');
    }, [phone, navigate]);

    const handleChange = (val, idx) => {
        if (!/^\d?$/.test(val)) return;
        const next = [...otp];
        next[idx] = val;
        setOtp(next);
        if (val && idx < 5) inputs.current[idx + 1]?.focus();
    };

    const handleKeyDown = (e, idx) => {
        if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
            inputs.current[idx - 1]?.focus();
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const code = otp.join('');
        if (code.length < 6) {
            toast.error('Please enter the 6-digit OTP');
            return;
        }
        navigate('/reset-password', { state: { phone, otp: code, identifier } });
    };

    const maskedPhone = phone ? `******${phone.slice(-4)}` : '';

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh' }}>
            {/* Left - Form */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 64px', background: '#fff' }}>
                <div style={{ maxWidth: 380, width: '100%', margin: '0 auto' }}>
                    <Link to="/forgot-password" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#555', textDecoration: 'none', fontSize: '0.88rem', marginBottom: 32 }}>
                        <FaArrowLeft size={12} /> Back
                    </Link>

                    <div style={{ marginBottom: 28 }}>
                        <h2 style={{ fontWeight: 800, fontSize: '1.8rem', marginBottom: 8 }}>
                            Verify <span style={{ color: '#2d7a3a' }}>OTP</span>
                        </h2>
                        <p style={{ color: '#777', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            We've sent a 6-digit OTP to your registered phone{' '}
                            <strong style={{ color: '#333' }}>{maskedPhone}</strong>
                        </p>
                        <div style={{ width: 40, height: 3, background: '#2d7a3a', marginTop: 12 }} />
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 28 }}>
                            {otp.map((digit, idx) => (
                                <input
                                    key={idx}
                                    ref={el => inputs.current[idx] = el}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={e => handleChange(e.target.value, idx)}
                                    onKeyDown={e => handleKeyDown(e, idx)}
                                    style={{
                                        width: 48, height: 52, textAlign: 'center', fontSize: '1.4rem', fontWeight: 700,
                                        border: `2px solid ${digit ? '#2d7a3a' : '#ddd'}`, borderRadius: 10, outline: 'none',
                                        transition: 'border-color 0.2s',
                                    }}
                                />
                            ))}
                        </div>

                        <button type="submit"
                            style={{ width: '100%', background: '#2d7a3a', color: '#fff', border: 'none', borderRadius: 8, padding: '13px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            Verify OTP <span style={{ fontSize: '1.1rem' }}>→</span>
                        </button>
                    </form>

                    <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.88rem', color: '#555' }}>
                        Remember your Password?{' '}
                        <Link to="/login" style={{ color: '#2d7a3a', fontWeight: 700, textDecoration: 'none' }}>Sign In</Link>
                    </p>
                </div>
            </div>
            {/* Right - Illustration */}
            <ResetAuthPanel />
            
        </div>
    );
};

export default OtpVerify;
