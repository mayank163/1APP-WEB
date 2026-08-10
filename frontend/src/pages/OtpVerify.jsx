import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaArrowLeft } from 'react-icons/fa';
import { ResetAuthPanel } from './AuthPanel';

const OtpVerify = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { phone, identifier, devOtp } = location.state || {};
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
                            Verify <span style={{ color: '#000000' }}>OTP</span>
                        </h2>
                        <p style={{ color: '#777', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            We've sent a 6-digit OTP to your registered phone{' '}
                            <strong style={{ color: '#333' }}>{maskedPhone}</strong>
                        </p>
                        <div style={{ width: 40, height: 3, background: '#000000', marginTop: 12 }} />
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
                                        border: `2px solid ${digit ? '#000000' : '#ddd'}`, borderRadius: 10, outline: 'none',
                                        transition: 'border-color 0.2s',
                                    }}
                                />
                            ))}
                        </div>

                        {/* Dev-mode OTP hint — only shown when Twilio SMS is off */}
                        {devOtp && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: '#fdf5ea',
                                border: '1.5px dashed #000000',
                                borderRadius: 10,
                                padding: '10px 16px',
                                marginBottom: 20,
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#000000', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                                        Dev mode · OTP
                                    </span>
                                    <span style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: 6, color: '#1a1a1a', fontFamily: 'monospace' }}>
                                        {devOtp}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    title="Auto-fill OTP"
                                    onClick={() => {
                                        const digits = devOtp.split('');
                                        setOtp(digits);
                                        inputs.current[5]?.focus();
                                    }}
                                    style={{
                                        background: '#000000', color: '#fff', border: 'none',
                                        borderRadius: 8, padding: '6px 14px', fontWeight: 700,
                                        fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0,
                                    }}
                                >
                                    Auto-fill
                                </button>
                            </div>
                        )}

                        <button type="submit"
                            style={{ width: '100%', background: '#000000', color: '#fff', border: 'none', borderRadius: 8, padding: '13px', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            Verify OTP <span style={{ fontSize: '1.1rem' }}>→</span>
                        </button>
                    </form>

                    <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.88rem', color: '#555' }}>
                        Remember your Password?{' '}
                        <Link to="/login" style={{ color: '#000000', fontWeight: 700, textDecoration: 'none' }}>Sign In</Link>
                    </p>
                </div>
            </div>
            {/* Right - Illustration */}
            <ResetAuthPanel />
            
        </div>
    );
};

export default OtpVerify;
