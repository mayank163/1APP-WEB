import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from '../services/adminApi';
import { FaLock, FaEnvelope, FaEye, FaEyeSlash, FaShieldAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';

const inputStyle = {
    border: 'none',
    outline: 'none',
    flex: 1,
    fontSize: '0.95rem',
    background: 'transparent',
};

const AdminPanel = () => (
    <div
        style={{
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px',
            position: 'relative',
            overflow: 'hidden',
        }}
    >
        {/* Decorative circles */}
        <div style={{
            position: 'absolute', top: -80, right: -80,
            width: 320, height: 320, borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
        }} />
        <div style={{
            position: 'absolute', bottom: -60, left: -60,
            width: 240, height: 240, borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
        }} />
        <div style={{
            position: 'absolute', top: '40%', left: -40,
            width: 160, height: 160, borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
        }} />

        {/* Icon */}
        <div style={{
            width: 90, height: 90, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            border: '2px solid rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 28,
        }}>
            <FaShieldAlt size={38} color="#fff" />
        </div>

        {/* Brand */}
        <p style={{
            fontWeight: 800, fontSize: '1.6rem', color: '#fff',
            letterSpacing: 3, marginBottom: 8, fontFamily: 'monospace',
        }}>
            1APP
        </p>
        <p style={{
            fontWeight: 600, fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)',
            letterSpacing: 4, textTransform: 'uppercase', marginBottom: 32,
        }}>
            Admin Portal
        </p>

        {/* Divider */}
        <div style={{ width: 48, height: 3, background: 'rgba(255,255,255,0.25)', borderRadius: 2, marginBottom: 32 }} />

        {/* Features list */}
        {[
            'Manage users & bookings',
            'Control categories & services',
            'Publish and edit blogs',
            'Track platform analytics',
        ].map((text, i) => (
            <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                marginBottom: 14, width: '100%', maxWidth: 260,
            }}>
                <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.4)', flexShrink: 0,
                }} />
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.88rem' }}>{text}</span>
            </div>
        ))}
    </div>
);

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await adminApi.login(email, password);
            if (res.success) {
                toast.success('Admin login successful!');
                navigate('/');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Invalid admin credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100vh', overflow: 'hidden' }}>
            {/* Left: decorative panel */}
            <AdminPanel />

            {/* Right: form */}
            <div style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                padding: '48px 56px', background: '#fff', height: '100%',
                boxSizing: 'border-box', overflowY: 'auto',
            }}>
                <div style={{ maxWidth: 400, width: '100%', margin: '0 auto' }}>

                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <p style={{ fontWeight: 800, fontSize: '1.25rem', color: '#1a1a1a', marginBottom: 4, letterSpacing: 0.5 }}>
                            <span style={{ color: '#1a1a1a' }}>1APP</span> ADMIN
                        </p>
                        <h2 style={{ fontWeight: 800, fontSize: '1.9rem', color: '#1a1a1a', margin: '4px 0 8px' }}>
                            Welcome Back
                        </h2>
                        <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>
                            Sign in to access the admin dashboard
                        </p>
                        <div style={{ width: 40, height: 3, background: '#1a1a1a', margin: '12px auto 0', borderRadius: 2 }} />
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Email field */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontWeight: 700, fontSize: '0.85rem', display: 'block', marginBottom: 6, color: '#1a1a1a' }}>
                                Admin Email
                            </label>
                            <div style={{
                                display: 'flex', alignItems: 'center',
                                border: '1.5px solid #ccc', borderRadius: 8,
                                padding: '10px 14px', gap: 10,
                            }}>
                                <FaEnvelope color="#888" size={14} />
                                <input
                                    type="email"
                                    required
                                    placeholder="admin@1app.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        {/* Password field */}
                        <div style={{ marginBottom: 8 }}>
                            <label style={{ fontWeight: 700, fontSize: '0.85rem', display: 'block', marginBottom: 6, color: '#1a1a1a' }}>
                                Password
                            </label>
                            <div style={{
                                display: 'flex', alignItems: 'center',
                                border: '1.5px solid #ccc', borderRadius: 8,
                                padding: '10px 14px', gap: 10,
                            }}>
                                <FaLock color="#888" size={14} />
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    required
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    style={{ ...inputStyle, flex: 1 }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#aaa', display: 'flex' }}
                                >
                                    {showPass ? <FaEye size={15} /> : <FaEyeSlash size={15} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%', background: '#1a1a1a', color: '#fff',
                                border: 'none', borderRadius: 8, padding: '13px',
                                fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: 8, marginTop: 24,
                                opacity: loading ? 0.7 : 1,
                            }}
                        >
                            {loading ? 'Signing in...' : 'Enter Dashboard'} <span style={{ fontSize: '1.1rem' }}>→</span>
                        </button>
                    </form>

                    {/* Footer note */}
                    <p style={{ textAlign: 'center', marginTop: 28, fontSize: '0.82rem', color: '#bbb' }}>
                        Restricted access — authorised personnel only
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
