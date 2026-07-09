import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { FaPhone, FaEnvelope, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useGoogleLogin } from '@react-oauth/google';
import AuthPanel from './AuthPanel';
import axios from 'axios';

const inputStyle = { border: 'none', outline: 'none', flex: 1, fontSize: '0.95rem', background: 'transparent' };

const GoogleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
);

const LoginPage = () => {
    const { login, isAuthenticated, loading } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const fromPath = location.state?.from?.pathname || '/';

    const [useEmail, setUseEmail] = useState(false);
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);

    useEffect(() => {
        if (isAuthenticated) navigate(fromPath, { replace: true });
    }, [isAuthenticated, fromPath, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(identifier, password);
            toast.success('Logged in successfully!');
        } catch (err) {
            toast.error(err.message || 'Login failed');
        }
    };

    const googleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                await login(data.email, data.sub, { googleId: data.sub, name: data.name, picture: data.picture });
                toast.success('Logged in with Google!');
            } catch { toast.error('Google login failed'); }
        },
        onError: () => toast.error('Google login failed'),
        scope: 'openid email profile',
    });

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: '100vh', overflow: 'hidden' }}>
            {/* left: Auth Panel */}
            <AuthPanel />
            {/* right: Form */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 56px', background: '#fff', height: '100%', boxSizing: 'border-box', overflowY: 'auto' }}>
                <div style={{ maxWidth: 400, width: '100%', margin: '0 auto' }}>

                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <p style={{ fontWeight: 800, fontSize: '1.25rem', color: '#1a1a1a', marginBottom: 4, letterSpacing: 0.5 }}>
                            <span style={{ color: '#2d7a3a' }}>1APP</span> PORTAL
                        </p>
                        <h2 style={{ fontWeight: 800, fontSize: '1.9rem', color: '#2d7a3a', margin: '4px 0 8px' }}>Welcome Back</h2>
                        <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>Login to your account to continue</p>
                        <div style={{ width: 40, height: 3, background: '#2d7a3a', margin: '12px auto 0', borderRadius: 2 }} />
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Phone / Email field */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ fontWeight: 700, fontSize: '0.85rem', display: 'block', marginBottom: 6, color: '#1a1a1a' }}>
                                {useEmail ? 'Email Address' : 'Phone Number'}
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #ccc', borderRadius: 8, padding: '10px 14px', gap: 10 }}>
                                {useEmail ? <FaEnvelope color="#888" size={14} /> : <FaPhone color="#888" size={14} />}
                                <input
                                    type={useEmail ? 'email' : 'tel'}
                                    required
                                    placeholder={useEmail ? 'name@example.com' : '+91 98765 43210'}
                                    value={identifier}
                                    onChange={e => setIdentifier(e.target.value)}
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ textAlign: 'right', marginTop: 5 }}>
                                <button type="button" onClick={() => { setUseEmail(!useEmail); setIdentifier(''); }}
                                    style={{ background: 'none', border: 'none', color: '#2d7a3a', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                                    {useEmail ? 'Use Phone Number' : 'Use Email'}
                                </button>
                            </div>
                        </div>

                        {/* Password field */}
                        <div style={{ marginBottom: 8 }}>
                            <label style={{ fontWeight: 700, fontSize: '0.85rem', display: 'block', marginBottom: 6, color: '#1a1a1a' }}>Password</label>
                            <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #ccc', borderRadius: 8, padding: '10px 14px', gap: 10 }}>
                                <FaLock color="#888" size={14} />
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    required
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    style={{ ...inputStyle, flex: 1 }}
                                />
                                <button type="button" onClick={() => setShowPass(!showPass)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#aaa', display: 'flex' }}>
                                    {showPass ? <FaEye size={15} /> : <FaEyeSlash size={15} />}
                                </button>
                            </div>
                            <div style={{ textAlign: 'right', marginTop: 5 }}>
                                <Link to="/forgot-password" style={{ color: '#2d7a3a', fontSize: '0.82rem', fontWeight: 700, textDecoration: 'none' }}>
                                    Forgot password ?
                                </Link>
                            </div>
                        </div>

                        <button type="submit" disabled={loading} style={{
                            width: '100%', background: '#2d7a3a', color: '#fff', border: 'none',
                            borderRadius: 8, padding: '13px', fontWeight: 700, fontSize: '1rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 8, marginTop: 20
                        }}>
                            {loading ? 'Logging in...' : 'Login'} <span style={{ fontSize: '1.1rem' }}>→</span>
                        </button>
                    </form>

                    {/* OR divider */}
                    <div style={{ display: 'flex', alignItems: 'center', margin: '22px 0', gap: 10 }}>
                        <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
                        <span style={{ color: '#aaa', fontSize: '0.8rem', fontWeight: 600, letterSpacing: 1 }}>OR</span>
                        <div style={{ flex: 1, height: 1, background: '#e0e0e0' }} />
                    </div>

                    <button onClick={() => googleLogin()} style={{
                        width: '100%', background: '#fff', border: '1.5px solid #ddd',
                        borderRadius: 8, padding: '12px', fontWeight: 700, fontSize: '0.95rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
                    }}>
                        <GoogleIcon />
                        Continue with Google
                    </button>

                    <p style={{ textAlign: 'center', marginTop: 22, fontSize: '0.88rem', color: '#555' }}>
                        Don't have an account?{' '}
                        <Link to="/signup" style={{ color: '#2d7a3a', fontWeight: 700, textDecoration: 'none' }}>Sign Up</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
