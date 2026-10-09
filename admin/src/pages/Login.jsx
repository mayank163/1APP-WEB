import '../styles/Login.css';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import adminApi from '../services/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
import { FaLock, FaEnvelope, FaEye, FaEyeSlash, FaShieldAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';

const AdminPanel = () => (
    <div
        className="admin-login-1"
    >
        {/* Decorative circles */}
        <div className="admin-login-2"  />
        <div className="admin-login-3"  />
        <div className="admin-login-4"  />

        {/* Icon */}
        <div className="admin-login-5" >
            <FaShieldAlt size={38} color="#A5732F" />
        </div>

        {/* Brand */}
        <p className="admin-login-6" >
            1APP
        </p>
        <p className="admin-login-7" >
            Admin Portal
        </p>

        {/* Divider */}
        <div className="admin-login-8"  />

        {/* Features list */}
        {[
            'Manage users & bookings',
            'Control categories & services',
            'Publish and edit blogs',
            'Track platform analytics',
        ].map((text, i) => (
            <div key={i} className="admin-login-9" >
                <div className="admin-login-10"  />
                <span className="admin-login-11" >{text}</span>
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
                            <span className="admin-login-17" >1APP</span> ADMIN
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
                            <label className="admin-login-22" >
                                Admin Email
                            </label>
                            <div className="admin-login-23" >
                                <FaEnvelope color="#888" size={14} />
                                <input
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
                            <label className="admin-login-26" >
                                Password
                            </label>
                            <div className="admin-login-27" >
                                <FaLock color="#888" size={14} />
                                <input
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
                            {loading ? 'Signing in...' : 'Enter Dashboard'} <span className="admin-login-31" >→</span>
                        </button>
                    </form>

                    {/* Footer note */}
                    <p className="admin-login-32" >
                        Restricted access — authorised personnel only
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
