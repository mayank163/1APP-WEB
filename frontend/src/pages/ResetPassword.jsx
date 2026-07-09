import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { FaLock, FaEye, FaEyeSlash, FaArrowLeft } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from 'axios';
import { ResetAuthPanel } from './AuthPanel';


const ResetPassword = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { phone, otp } = location.state || {};

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);


    useEffect(() => {
        if (!phone || !otp) navigate('/forgot-password');
    }, [phone, otp, navigate]);

    const passwordsMatch = confirmPassword && newPassword === confirmPassword;
    const passwordsMismatch = confirmPassword && newPassword !== confirmPassword;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }
        if (newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }
        setLoading(true);
        try {
            const res = await axios.post(process.env.REACT_APP_API_URL + '/auth/reset-password', {
                phone,
                otp,
                newPassword,
            });
            if (res.data.success) {
                toast.success(res.data.message || 'Password reset successfully');
                navigate('/login');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Reset failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh' }}>
            {/* Left - illustration */}
            <ResetAuthPanel />

            {/* Right - Form */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 64px', background: '#fff' }}>
                <div style={{ maxWidth: 380, width: '100%', margin: '0 auto' }}>
                    <Link to="/forgot-password" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#555', textDecoration: 'none', fontSize: '0.88rem', marginBottom: 32 }}>
                        <FaArrowLeft size={12} /> Back
                    </Link>

                    <div style={{ marginBottom: 28 }}>
                        <h2 style={{ fontWeight: 800, fontSize: '1.8rem', marginBottom: 8 }}>
                            Reset <span style={{ color: '#2d7a3a' }}>Password</span>
                        </h2>
                        <p style={{ color: '#777', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            Create a new strong password for your account.
                        </p>
                        <div style={{ width: 40, height: 3, background: '#2d7a3a', marginTop: 12 }} />
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontWeight: 700, fontSize: '0.85rem', display: 'block', marginBottom: 6 }}>New Password</label>
                            <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #ddd', borderRadius: 8, padding: '10px 14px', gap: 10 }}>
                                <FaLock color="#888" size={14} />
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    required
                                    placeholder="••••••••"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.95rem' }}
                                />
                                <button type="button" onClick={() => setShowNew(!showNew)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#888' }}>
                                    {showNew ? <FaEye size={15} /> : <FaEyeSlash size={15} />}
                                </button>
                            </div>
                        </div>

                        <div style={{ marginBottom: 20 }}>
                            <label style={{ fontWeight: 700, fontSize: '0.85rem', display: 'block', marginBottom: 6 }}>Confirm Password</label>
                            <div style={{
                                display: 'flex', alignItems: 'center', borderRadius: 8, padding: '10px 14px', gap: 10,
                                border: `1.5px solid ${passwordsMismatch ? '#e53935' : passwordsMatch ? '#2d7a3a' : '#ddd'}`,
                            }}>
                                <FaLock color={passwordsMismatch ? '#e53935' : passwordsMatch ? '#2d7a3a' : '#888'} size={14} />
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    required
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.95rem' }}
                                />
                                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#888' }}>
                                    {showConfirm ? <FaEye size={15} /> : <FaEyeSlash size={15} />}
                                </button>
                            </div>
                            {passwordsMismatch && (
                                <p style={{ color: '#e53935', fontSize: '0.78rem', marginTop: 4, marginBottom: 0 }}>Passwords do not match</p>
                            )}
                            {passwordsMatch && (
                                <p style={{ color: '#2d7a3a', fontSize: '0.78rem', marginTop: 4, marginBottom: 0 }}>✓ Passwords match</p>
                            )}
                        </div>

                        <button type="submit" disabled={loading || passwordsMismatch}
                            style={{
                                width: '100%', background: passwordsMismatch ? '#aaa' : '#2d7a3a', color: '#fff', border: 'none',
                                borderRadius: 8, padding: '13px', fontWeight: 700, fontSize: '1rem', cursor: passwordsMismatch ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            }}>
                            {loading ? 'Resetting...' : 'Reset Password'} <span style={{ fontSize: '1.1rem' }}>→</span>
                        </button>
                    </form>

                    <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.88rem', color: '#555' }}>
                        Remember your Password?{' '}
                        <Link to="/login" style={{ color: '#2d7a3a', fontWeight: 700, textDecoration: 'none' }}>Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
