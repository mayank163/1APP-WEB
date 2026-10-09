import { cssValue } from '../utils/cssValue';
import '../styles/ResetPassword.css';
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
        <div className="ui-resetpassword-1" >
            {/* Left - illustration */}
            <ResetAuthPanel />

            {/* Right - Form */}
            <div className="ui-resetpassword-2" >
                <div className="ui-resetpassword-3" >
                    <Link className="ui-resetpassword-4" to="/forgot-password" >
                        <FaArrowLeft size={12} /> Back
                    </Link>

                    <div className="ui-resetpassword-5" >
                        <h2 className="ui-resetpassword-6" >
                            Reset <span className="ui-resetpassword-7" >Password</span>
                        </h2>
                        <p className="ui-resetpassword-8" >
                            Create a new strong password for your account.
                        </p>
                        <div className="ui-resetpassword-9"  />
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="ui-resetpassword-10" >
                            <label className="ui-resetpassword-11" >New Password</label>
                            <div className="ui-resetpassword-12" >
                                <FaLock color="#888" size={14} />
                                <input className="ui-resetpassword-13"
                                    type={showNew ? 'text' : 'password'}
                                    required
                                    placeholder="••••••••"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}

                                />
                                <button className="ui-resetpassword-14" type="button" onClick={() => setShowNew(!showNew)}
                                    >
                                    {showNew ? <FaEye size={15} /> : <FaEyeSlash size={15} />}
                                </button>
                            </div>
                        </div>

                        <div className="ui-resetpassword-15" >
                            <label className="ui-resetpassword-16" >Confirm Password</label>
                            <div className="ui-resetpassword-17" style={{ "--ui-resetpassword-17-border": cssValue(`1.5px solid ${passwordsMismatch ? '#e53935' : passwordsMatch ? '#000000' : '#ddd'}`, "border") }}>
                                <FaLock color={passwordsMismatch ? '#e53935' : passwordsMatch ? '#000000' : '#888'} size={14} />
                                <input className="ui-resetpassword-18"
                                    type={showConfirm ? 'text' : 'password'}
                                    required
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}

                                />
                                <button className="ui-resetpassword-19" type="button" onClick={() => setShowConfirm(!showConfirm)}
                                    >
                                    {showConfirm ? <FaEye size={15} /> : <FaEyeSlash size={15} />}
                                </button>
                            </div>
                            {passwordsMismatch && (
                                <p className="ui-resetpassword-20" >Passwords do not match</p>
                            )}
                            {passwordsMatch && (
                                <p className="ui-resetpassword-21" >✓ Passwords match</p>
                            )}
                        </div>

                        <button className="ui-resetpassword-22" type="submit" disabled={loading || passwordsMismatch}
                            style={{ "--ui-resetpassword-22-background": cssValue(passwordsMismatch ? "var(--ui-color-19)" : "var(--ui-color-27)", "background"), "--ui-resetpassword-22-cursor": cssValue(passwordsMismatch ? 'not-allowed' : 'pointer', "cursor") }}>
                            {loading ? 'Resetting...' : 'Reset Password'} <span className="ui-resetpassword-23" >→</span>
                        </button>
                    </form>

                    <p className="ui-resetpassword-24" >
                        Remember your Password?{' '}
                        <Link className="ui-resetpassword-25" to="/login" >Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
