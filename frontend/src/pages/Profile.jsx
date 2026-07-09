import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { FaEnvelope, FaPhone, FaMapMarkerAlt, FaCheckCircle, FaExclamationTriangle, FaCheckDouble, FaUpload } from 'react-icons/fa';
import { toast } from 'react-toastify';

const Profile = () => {
    const { user, updateProfile, sendOTP, verifyOTP, loading } = useContext(AuthContext);

    // Form inputs
    const [name, setName] = useState(user?.name || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [address, setAddress] = useState(user?.address || '');
    const [addressLen, setAddressLen] = useState((user?.address || '').length);
    const [updating, setUpdating] = useState(false);

    // OTP verification variables
    const [showOtpField, setShowOtpField] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [verifying, setVerifying] = useState(false);

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        if (!name.trim() || !phone.trim()) {
            toast.error('Name and Phone number are required!');
            return;
        }

        setUpdating(true);
        try {
            await updateProfile({ name, phone, address });
            toast.success('Profile updated successfully!');
            setShowOtpField(false); // Reset in case phone changed
        } catch (err) {
            toast.error(err.message || 'Failed to update profile');
        } finally {
            setUpdating(false);
        }
    };

    const handleRequestOtp = async () => {
        try {
            const res = await sendOTP();
            if (res.success) {
                setShowOtpField(true);
                toast.success('Verification OTP sent! Check console / logs.');
            }
        } catch (err) {
            toast.error(err.message || 'Failed to trigger verification code');
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (!otpCode.trim()) {
            toast.error('Please enter the 6-digit OTP code');
            return;
        }

        setVerifying(true);
        try {
            const res = await verifyOTP(otpCode);
            if (res.success) {
                toast.success('Phone verified successfully!');
                setShowOtpField(false);
                setOtpCode('');
            }
        } catch (err) {
            toast.error(err.message || 'Invalid verification code');
        } finally {
            setVerifying(false);
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading profile..." />;
    }

    return (
        <div className="container py-4 ">
            <h1 className="fw-extrabold text-dark mb-1" style={{ fontSize: '2rem' }}>My Profile</h1>
            <div className="mb-4" style={{ width: '152px', height: '4px', background: '#2d6a4f', borderRadius: '2px' }} />

            <div className="row g-4">
                {/* 1. Profile overview */}
                <div className="col-lg-4">
                    <div className="card border-0 shadow-sm rounded-4 bg-white p-4 text-center">
                        <div className="mx-auto mb-3" style={{ width: '100px', height: '100px', borderRadius: '50%', border: '3px solid #2d6a4f', overflow: 'hidden', background: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span className="fw-bold text-secondary" style={{ fontSize: '2rem' }}>
                                {user?.name?.charAt(0)?.toUpperCase()}
                            </span>
                        </div>
                        <h4 className="fw-bold mb-1">{user?.name}</h4>
                        <span className="badge text-uppercase mb-4" style={{ background: '#d8f3dc', color: '#2d6a4f', fontSize: '0.7rem', padding: '5px 10px' ,alignSelf: 'center'}}>{user?.role}</span>

                        <div className="text-start d-flex flex-column gap-3 pt-3 border-top w-100">
                            <div className="d-flex align-items-center gap-2 text-muted">
                                <FaEnvelope size={14} />
                                <span className="small">{user?.email}</span>
                            </div>
                            <div className="d-flex align-items-center justify-content-between text-muted">
                                <div className="d-flex align-items-center gap-2">
                                    <FaPhone size={14} />
                                    <span className="small">{user?.phone}</span>
                                </div>
                                {user?.isPhoneVerified ? (
                                    <span className="badge d-flex align-items-center gap-1" style={{ background: '#d8f3dc', color: '#2d6a4f' }}>
                                        <FaCheckCircle size={10} /> Verified
                                    </span>
                                ) : (
                                    <span className="badge bg-warning-subtle text-warning d-flex align-items-center gap-1">
                                        <FaExclamationTriangle size={10} /> Unverified
                                    </span>
                                )}
                            </div>
                        </div>

                        {!user?.isPhoneVerified && (
                            <div className="mt-4 pt-3 border-top w-100">
                                {!showOtpField ? (
                                    <button onClick={handleRequestOtp} className="btn w-100 fw-bold py-2 d-flex align-items-center justify-content-center gap-2" style={{ background: '#2d6a4f', color: '#fff', borderRadius: '8px' }}>
                                        <FaCheckDouble size={14} /> Verify Phone Number
                                    </button>
                                ) : (
                                    <form onSubmit={handleVerifyOtp} className="text-start bg-light p-3 rounded border">
                                        <label className="form-label small fw-bold text-muted mb-2">Enter 6-digit OTP (check server console):</label>
                                        <div className="d-flex gap-2">
                                            <input type="text" maxLength="6" required className="form-control text-center font-monospace" placeholder="999999" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
                                            <button type="submit" disabled={verifying} className="btn fw-bold" style={{ background: '#2d6a4f', color: '#fff' }}>
                                                {verifying ? '...' : 'Verify'}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Edit Profile */}
                <div className="col-lg-8">
                    <div className="card border-0 shadow-sm rounded-4 bg-white p-4">
                        <h5 className="fw-bold mb-4">Edit Personal Information</h5>
                        <form onSubmit={handleSaveProfile}>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold small text-dark mb-1">Full Name</label>
                                    <input type="text" required className="form-control" style={{ background: '#f8f9fa', border: '1px solid #e9ecef' }} value={name} onChange={(e) => setName(e.target.value)} />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold small text-dark mb-1">Phone Number</label>
                                    <input type="tel" required className="form-control" style={{ background: '#f8f9fa', border: '1px solid #e9ecef' }} value={phone} onChange={(e) => setPhone(e.target.value)} />
                                </div>
                                <div className="col-12">
                                    <label className="form-label fw-semibold small text-dark mb-1 d-flex align-items-center gap-2">
                                        <FaMapMarkerAlt size={13} /> Default Delivery Address
                                    </label>
                                    <div className="position-relative">
                                        <textarea rows="5" maxLength={200} className="form-control" style={{ background: '#f8f9fa', border: '1px solid #e9ecef', resize: 'none' }} placeholder="Add default home or office address details..." value={address} onChange={(e) => { setAddress(e.target.value); setAddressLen(e.target.value.length); }} />
                                        <small className="text-muted position-absolute" style={{ bottom: '8px', right: '12px', fontSize: '0.72rem' }}>{addressLen}/200</small>
                                    </div>
                                </div>
                            </div>
                            <button type="submit" disabled={updating} className="btn fw-bold px-4 py-2 mt-3 d-flex align-items-center gap-2" style={{ background: '#2d6a4f', color: '#fff', borderRadius: '8px' }}>
                                <FaUpload size={14} /> {updating ? 'Saving...' : 'Save Settings'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
