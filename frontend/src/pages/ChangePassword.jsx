import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaEye, FaEyeSlash, FaLock } from 'react-icons/fa';
import { toast } from 'react-toastify';
import API from '../services/api';
import { ResetAuthPanel } from './AuthPanel';
import '../styles/ChangePassword.css';

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
        <main className="change-password-page">
            <div className="change-password-illustration" aria-hidden="true"><ResetAuthPanel /></div>
            <section className="change-password-form-panel">
                <div className="change-password-form-content">
                <Link to="/profile" className="change-password-back">
                    <FaArrowLeft size={12} /> Back to Profile
                </Link>
                <div className="change-password-heading">
                    <h1>Change Password</h1>
                    <p>Enter your current password, then choose a new one to keep your account secure.</p>
                    <div className="change-password-heading-line" />
                </div>

                <form onSubmit={handleSubmit}>
                    {passwordFields.map(field => (
                        <div className="change-password-field" key={field.name}>
                            <label className="change-password-label" htmlFor={field.name}>{field.label}</label>
                            <div className="change-password-input">
                                <FaLock className="change-password-lock" size={14} aria-hidden="true" />
                                <input
                                    id={field.name}
                                    type={visibleFields[field.name] ? 'text' : 'password'}
                                    autoComplete={field.autoComplete}
                                    placeholder={field.name === 'oldPassword' ? 'Enter your current password' : field.name === 'newPassword' ? 'Enter your new password' : 'Confirm your new password'}
                                    aria-invalid={field.name === 'confirmPassword' && Boolean(passwordsMismatch)}
                                    aria-describedby={field.name === 'confirmPassword' && passwordsMismatch ? 'change-password-error' : undefined}
                                    required
                                    minLength={field.name === 'oldPassword' ? undefined : 6}
                                    value={passwords[field.name]}
                                    onChange={event => setPasswords(previous => ({ ...previous, [field.name]: event.target.value }))}
                                />
                                <button
                                    className="change-password-visibility"
                                    type="button"
                                    aria-label={`${visibleFields[field.name] ? 'Hide' : 'Show'} ${field.label.toLowerCase()}`}
                                    onClick={() => setVisibleFields(previous => ({ ...previous, [field.name]: !previous[field.name] }))}
                                >
                                    {visibleFields[field.name] ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>
                    ))}

                    {passwordsMismatch && <div id="change-password-error" className="small text-danger mb-3" role="alert">New passwords do not match.</div>}
                    <button className="change-password-submit" type="submit" disabled={loading || Boolean(passwordsMismatch)}>
                        {loading ? 'Updating password...' : 'Update Password'} <span aria-hidden="true">→</span>
                    </button>
                </form>
                <div className="change-password-divider"><span /><strong>OR</strong><span /></div>
                <p className="change-password-help">Forgot your current password? <Link to="/forgot-password">Reset Password</Link></p>
                </div>
            </section>
        </main>
    );
};

export default ChangePassword;