import '../styles/Login.css';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from '../services/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
import { FaLock, FaUser, FaEye, FaEyeSlash } from 'react-icons/fa';
import { toast } from 'react-toastify';
import loginArtwork from '../assets/admin-login-artwork.png';

const AdminPanel = () => (
    <div className="admin-login-artwork" aria-hidden="true">
        <svg viewBox="224 0 3516 3936" preserveAspectRatio="xMidYMid slice" focusable="false">
            <image href={loginArtwork} width="3740" height="3936" />
        </svg>
    </div>
);

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { saveAdmin } = useAdminAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await adminApi.login(email, password);
            if (res.success) {
                saveAdmin(res.data?.admin || {});
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
        <div className="admin-login-12" >
            {/* Left: decorative panel */}
            <AdminPanel />

            {/* Right: form */}
            <div className="admin-login-13" >
                <div className="admin-login-14" >

                    {/* Header */}
                    <div className="admin-login-15" >
                        <p className="admin-login-16" >
                            <span className="admin-login-17" >1APP</span> Admin Portal
                        </p>
                        <h2 className="admin-login-18" >
                            Welcome Back
                        </h2>
                        <p className="admin-login-19" >
                            Sign in to access the admin dashboard
                        </p>
                        <div className="admin-login-20"  />
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Email field */}
                        <div className="admin-login-21" >
                            <label className="admin-login-22" htmlFor="admin-email">
                                Admin Email
                            </label>
                            <div className="admin-login-23" >
                                <FaUser color="#111" size={14} />
                                <input
                                    id="admin-email"
                                    autoComplete="username"
                                    type="email"
                                    required
                                    placeholder="admin@1app.com"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="admin-login-24"
                                />
                            </div>
                        </div>

                        {/* Password field */}
                        <div className="admin-login-25" >
                            <label className="admin-login-26" htmlFor="admin-password">
                                Password
                            </label>
                            <div className="admin-login-27" >
                                <FaLock color="#111" size={14} />
                                <input
                                    id="admin-password"
                                    autoComplete="current-password"
                                    type={showPass ? 'text' : 'password'}
                                    required
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="admin-login-28"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    aria-label={showPass ? 'Hide password' : 'Show password'}
                                    aria-pressed={showPass}
                                    className="admin-login-29"
                                >
                                    {showPass ? <FaEye size={15} /> : <FaEyeSlash size={15} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={["admin-login-30 ", loading ? "admin-login-state-1" : "admin-login-state-2"].join('')}
                        >
                            {loading ? 'Signing in...' : 'Enter Dashboard Panel'} <span className="admin-login-31" >→</span>
                        </button>
                    </form>


                </div>
            </div>
        </div>
    );
};

export default Login;
