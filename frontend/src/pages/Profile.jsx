import React, { useContext, useState, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { ProfileShimmer } from '../components/Shimmer';
import { FaEnvelope, FaPhone, FaMapMarkerAlt, FaCheckCircle, FaExclamationTriangle, FaCheckDouble, FaUpload, FaPhoneAlt, FaCrosshairs, FaCamera } from 'react-icons/fa';
import { toast } from 'react-toastify';

// Reverse-geocode lat/lng → human-readable address using OpenStreetMap Nominatim (free, no key needed)
const reverseGeocode = async (lat, lng) => {
    const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) throw new Error('Geocoding request failed');
    const data = await res.json();
    return data.display_name || '';
};

const Profile = () => {
    const { user, updateProfile, uploadProfileImage, sendOTP, verifyOTP, loading } = useContext(AuthContext);

    // Form inputs
    const [name, setName] = useState(user?.name || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [address, setAddress] = useState(user?.address || '');
    const [addressLen, setAddressLen] = useState((user?.address || '').length);
    const [updating, setUpdating] = useState(false);
    const [locating, setLocating] = useState(false);

    // Avatar upload
    const avatarInputRef = useRef(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // OTP verification variables
    const [showOtpField, setShowOtpField] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [verifying, setVerifying] = useState(false);

    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Show local preview immediately
        const reader = new FileReader();
        reader.onload = (ev) => setAvatarPreview(ev.target.result);
        reader.readAsDataURL(file);

        setUploadingAvatar(true);
        try {
            await uploadProfileImage(file);
            toast.success('Profile photo updated!');
        } catch (err) {
            toast.error(err.message || 'Failed to upload photo');
            setAvatarPreview(null);
        } finally {
            setUploadingAvatar(false);
            // Reset input so the same file can be re-selected if needed
            e.target.value = '';
        }
    };

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
            setShowOtpField(false);
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

    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser.');
            return;
        }

        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    const addr = await reverseGeocode(latitude, longitude);
                    const trimmed = addr.slice(0, 200);
                    setAddress(trimmed);
                    setAddressLen(trimmed.length);
                    toast.success('Current location detected!');
                } catch {
                    toast.error('Could not fetch address for your location.');
                } finally {
                    setLocating(false);
                }
            },
            (err) => {
                setLocating(false);
                if (err.code === err.PERMISSION_DENIED) {
                    toast.error('Location permission denied. Please allow access in your browser settings.');
                } else {
                    toast.error('Unable to retrieve your location.');
                }
            },
            { timeout: 10000 }
        );
    };

    if (loading) {
        return <ProfileShimmer />;
    }

    return (
        <div className="container py-4 ">
            <h1 className="fw-extrabold text-dark mb-1" style={{ fontSize: '2rem' }}>My Profile</h1>
            <div className="mb-4" style={{ width: '152px', height: '4px', background: '#2d6a4f', borderRadius: '2px' }} />

            <div className="row g-4">
                {/* 1. Profile overview */}
                <div className="col-lg-4">
                    <div className="card border-0 shadow-sm rounded-4 bg-white p-4 text-center">
                        {/* Clickable avatar */}
                        <div
                            className="mx-auto mb-3 position-relative"
                            style={{ width: '100px', height: '100px', cursor: 'pointer' }}
                            onClick={() => !uploadingAvatar && avatarInputRef.current.click()}
                            title="Click to change profile photo"
                        >
                            <div style={{ width: '100px', height: '100px', borderRadius: '50%', border: '3px solid #2d6a4f', overflow: 'hidden', background: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {avatarPreview || user?.profileImage?.url ? (
                                    <img
                                        src={avatarPreview || user.profileImage.url}
                                        alt="Profile"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <span className="fw-bold text-secondary" style={{ fontSize: '2rem' }}>
                                        {user?.name?.charAt(0)?.toUpperCase()}
                                    </span>
                                )}
                            </div>
                            {/* Camera overlay */}
                            <div
                                style={{
                                    position: 'absolute', bottom: 0, right: 0,
                                    width: '28px', height: '28px', borderRadius: '50%',
                                    background: uploadingAvatar ? '#adb5bd' : '#2d6a4f',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: '2px solid #fff', transition: 'background 0.2s'
                                }}
                            >
                                {uploadingAvatar
                                    ? <div className="spinner-border spinner-border-sm text-white" style={{ width: '14px', height: '14px', borderWidth: '2px' }} role="status" />
                                    : <FaCamera size={12} color="#fff" />
                                }
                            </div>
                        </div>
                        {/* Hidden file input */}
                        <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleAvatarChange}
                        />
                        <h4 className="fw-bold mb-1">{user?.name}</h4>
                        <span className="badge text-uppercase mb-4" style={{ background: '#d8f3dc', color: '#2d6a4f', fontSize: '0.7rem', padding: '5px 10px', alignSelf: 'center' }}>{user?.role}</span>

                        <div className="text-start d-flex flex-column gap-3 pt-3 border-top w-100">
                            <div className="d-flex align-items-center gap-2 text-muted">
                                <FaEnvelope size={14} />
                                <span className="small">{user?.email}</span>
                            </div>
                            <div className="d-flex align-items-center justify-content-between text-muted">
                                <div className="d-flex align-items-center gap-2">
                                    <FaPhoneAlt size={14} />
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
                                    <button onClick={handleRequestOtp} className="btn w-100 fw-bold py-2 d-flex align-items-center justify-content-center gap-2" style={{ background: '#000000', color: '#fff', borderRadius: '8px' }}>
                                        <FaCheckDouble size={14} /> Verify Phone Number
                                    </button>
                                ) : (
                                    <form onSubmit={handleVerifyOtp} className="text-start bg-light p-3 rounded border">
                                        <label className="form-label small fw-bold text-muted mb-2">Enter 6-digit OTP (check server console):</label>
                                        <div className="d-flex gap-2">
                                            <input type="text" maxLength="6" required className="form-control text-center font-monospace" placeholder="999999" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
                                            <button type="submit" disabled={verifying} className="btn fw-bold" style={{ background: '#000000', color: '#fff' }}>
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
                                    <div className="d-flex align-items-center justify-content-between mb-1">
                                        <label className="form-label fw-semibold small text-dark mb-0 d-flex align-items-center gap-2">
                                            <FaMapMarkerAlt size={13} /> Default Delivery Address
                                        </label>
                                        <button
                                            type="button"
                                            onClick={handleUseCurrentLocation}
                                            disabled={locating}
                                            className="btn btn-sm d-flex align-items-center gap-1 fw-semibold"
                                            style={{ background: '#f0fff4', color: '#2d6a4f', border: '1px solid #b7e4c7', borderRadius: '6px', fontSize: '0.75rem', padding: '4px 10px' }}
                                        >
                                            <FaCrosshairs size={11} />
                                            {locating ? 'Detecting...' : 'Use Current Location'}
                                        </button>
                                    </div>
                                    <div className="position-relative">
                                        <textarea
                                            rows="5"
                                            maxLength={200}
                                            className="form-control"
                                            style={{ background: '#f8f9fa', border: '1px solid #e9ecef', resize: 'none' }}
                                            placeholder="Add default home or office address details..."
                                            value={address}
                                            onChange={(e) => { setAddress(e.target.value); setAddressLen(e.target.value.length); }}
                                        />
                                        <small className="text-muted position-absolute" style={{ bottom: '8px', right: '12px', fontSize: '0.72rem' }}>{addressLen}/200</small>
                                    </div>
                                </div>
                            </div>
                            <button type="submit" disabled={updating} className="btn fw-bold px-4 py-2 mt-3 d-flex align-items-center gap-2" style={{ background: '#000000', color: '#fff', borderRadius: '8px' }}>
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
