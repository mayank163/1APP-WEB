import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaEye, FaEyeSlash, FaLock } from 'react-icons/fa';
import { toast } from 'react-toastify';
import API from '../services/api';

const initialPasswords = {
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
};

const passwordFields = [
    { name: 'oldPassword', label: 'Current password', autoComplete: 'current-password' },
    { name: 'newPassword', label: 'New password', autoComplete: 'new-password' },
    { name: 'confirmPassword', label: 'Confirm new password', autoComplete: 'new-password' },
];

const ChangePassword = () => {
    const navigate = useNavigate();
    const [passwords, setPasswords] = useState(initialPasswords);
    const [visibleFields, setVisibleFields] = useState({});
    const [loading, setLoading] = useState(false);
    const passwordsMismatch = passwords.confirmPassword && passwords.newPassword !== passwords.confirmPassword;

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (passwords.newPassword !== passwords.confirmPassword) {
            toast.error('New passwords do not match.');
            return;
        }
        if (passwords.newPassword.length < 6) {
            toast.error('Password must be at least 6 characters.');
            return;
        }

        setLoading(true);
        try {
            const response = await API.put('/auth/change-password', {
                oldPassword: passwords.oldPassword,
                newPassword: passwords.newPassword,
            });
            toast.success(response.data.message || 'Password changed successfully.');
            setPasswords(initialPasswords);
            navigate('/profile');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Could not change password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="container py-5">
            <section className="bg-white border rounded-3 shadow-sm p-4 p-md-5 mx-auto" style={{ maxWidth: 520 }}>
                <Link to="/profile" className="d-inline-flex align-items-center gap-2 text-secondary text-decoration-none small mb-4">
                    <FaArrowLeft size={12} /> Back to profile
                </Link>
                <h1 className="h3 fw-bold mb-2">Change password</h1>
                <p className="text-secondary mb-4">Enter your current password, then choose a new one.</p>

                <form onSubmit={handleSubmit}>
                    {passwordFields.map(field => (
                        <div className="mb-3" key={field.name}>
                            <label className="form-label fw-semibold" htmlFor={field.name}>{field.label}</label>
                            <div className="input-group">
                                <span className="input-group-text bg-white"><FaLock className="text-secondary" /></span>
                                <input
                                    id={field.name}
                                    className="form-control"
                                    type={visibleFields[field.name] ? 'text' : 'password'}
                                    autoComplete={field.autoComplete}
                                    required
                                    minLength={field.name === 'oldPassword' ? undefined : 6}
                                    value={passwords[field.name]}
                                    onChange={event => setPasswords(previous => ({ ...previous, [field.name]: event.target.value }))}
                                />
                                <button
                                    className="btn btn-outline-secondary"
                                    type="button"
                                    aria-label={`${visibleFields[field.name] ? 'Hide' : 'Show'} ${field.label.toLowerCase()}`}
                                    onClick={() => setVisibleFields(previous => ({ ...previous, [field.name]: !previous[field.name] }))}
                                >
                                    {visibleFields[field.name] ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>
                    ))}

                    {passwordsMismatch && <div className="small text-danger mb-3">New passwords do not match.</div>}
                    <button className="btn btn-dark w-100 py-2 fw-semibold" type="submit" disabled={loading || Boolean(passwordsMismatch)}>
                        {loading ? 'Updating password...' : 'Update password'}
                    </button>
                </form>
            </section>
        </main>
    );
};

export default ChangePassword;