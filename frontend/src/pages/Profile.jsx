import React, { useContext, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ProfileShimmer } from '../components/Shimmer';
import LocationPicker from '../components/LocationPicker';
import {
    FaEnvelope, FaPhone, FaCheckCircle, FaExclamationTriangle,
    FaCheckDouble, FaUpload, FaPhoneAlt, FaCamera,
    FaMapMarkerAlt, FaPlus, FaTrash, FaEdit, FaStar, FaHome, FaBriefcase, FaTimes, FaCheck
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { resolveImageUrl } from '../services/api';

// Label → icon mapping
const labelIcon = (label = '') => {
    const l = label.toLowerCase();
    if (l === 'home') return <FaHome size={13} />;
    if (l === 'office' || l === 'work') return <FaBriefcase size={13} />;
    return <FaMapMarkerAlt size={13} />;
};

const LABEL_OPTIONS = ['Home', 'Office', 'Work', 'Other'];

const emptyForm = { label: 'Home', name: '', addressLine: '', city: '', state: '', zipcode: '' };

const Profile = () => {
    const { user, updateProfile, uploadProfileImage, sendOTP, verifyOTP, deleteAccount, loading } = useContext(AuthContext);
    const navigate = useNavigate();

    /* ─── personal info ─── */
    const [name, setName] = useState(user?.name || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth ? user.dateOfBirth.slice(0, 10) : '');
    const [gender, setGender] = useState(user?.gender || '');
    const [alternateContact, setAlternateContact] = useState(user?.alternateContact || '');
    const [updatingInfo, setUpdatingInfo] = useState(false);

    /* ─── avatar ─── */
    const avatarInputRef = useRef(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    /* ─── OTP ─── */
    const [showOtpField, setShowOtpField] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [verifying, setVerifying] = useState(false);

    /* ─── address panel ─── */
    // mode: null | 'add' | 'edit'
    const [addrMode, setAddrMode] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [addrForm, setAddrForm] = useState(emptyForm);
    const [locationValue, setLocationValue] = useState(null); // { address, lat, lng }
    const [savingAddr, setSavingAddr] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [deletingAccount, setDeletingAccount] = useState(false);

    const addresses = user?.addresses || [];

    /* ────────────────── helpers ────────────────── */
    const patchField = (key) => (e) => setAddrForm(f => ({ ...f, [key]: e.target.value }));

    const openAdd = () => {
        setAddrForm(emptyForm);
        setLocationValue(null);
        setEditingId(null);
        setAddrMode('add');
    };

    const openEdit = (addr) => {
        setAddrForm({
            label: addr.label || 'Home',
            name: addr.name || '',
            addressLine: addr.addressLine || '',
            city: addr.city || '',
            state: addr.state || '',
            zipcode: addr.zipcode || '',
        });
        // Reconstruct a display address for the map input
        setLocationValue(
            addr.addressLine
                ? { address: [addr.addressLine, addr.city, addr.state, addr.zipcode].filter(Boolean).join(', ') }
                : null
        );
        setEditingId(addr._id);
        setAddrMode('edit');
    };

    const closeAddrPanel = () => {
        setAddrMode(null);
        setEditingId(null);
        setLocationValue(null);
    };

    const safeStr = (v) => (v && typeof v === 'string' ? v.trim() : '');

    // Called by LocationPicker — fills all structured fields at once
    const handleLocationChange = ({ address, lat, lng, addressLine, city, state, zipcode }) => {
        setLocationValue({ address: safeStr(address) || address, lat, lng });
        setAddrForm(f => ({
            ...f,
            addressLine: safeStr(addressLine) || safeStr(address) || f.addressLine,
            city:        safeStr(city)        || f.city,
            state:       safeStr(state)       || f.state,
            zipcode:     safeStr(zipcode)     || f.zipcode,
        }));
    };

    /* ────────────────── avatar ────────────────── */
    const handleAvatarChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
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
            e.target.value = '';
        }
    };

    /* ────────────────── personal info save ────────────────── */
    const handleSaveInfo = async (e) => {
        e.preventDefault();
        if (!name.trim() || !phone.trim()) {
            toast.error('Name and phone are required!');
            return;
        }
        setUpdatingInfo(true);
        try {
            await updateProfile({ name, phone, dateOfBirth, gender, alternateContact });
            toast.success('Profile updated!');
            setShowOtpField(false);
        } catch (err) {
            toast.error(err.message || 'Failed to update profile');
        } finally {
            setUpdatingInfo(false);
        }
    };

    /* ────────────────── OTP ────────────────── */
    const handleRequestOtp = async () => {
        try {
            const res = await sendOTP();
            if (res.success) { setShowOtpField(true); toast.success('OTP sent!'); }
        } catch (err) {
            toast.error(err.message || 'Failed to send OTP');
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (!otpCode.trim()) { toast.error('Enter the 6-digit OTP'); return; }
        setVerifying(true);
        try {
            const res = await verifyOTP(otpCode);
            if (res.success) {
                toast.success('Phone verified!');
                setShowOtpField(false);
                setOtpCode('');
            }
        } catch (err) {
            toast.error(err.message || 'Invalid OTP');
        } finally {
            setVerifying(false);
        }
    };

    /* ────────────────── address CRUD ────────────────── */
    const handleSaveAddress = async (e) => {
        e.preventDefault();
        const addrLine = safeStr(addrForm.addressLine);
        if (!addrLine) {
            toast.error('Address line is required');
            return;
        }
        setSavingAddr(true);
        try {
            const payload = {
                ...addrForm,
                addressLine: addrLine,
                ...(locationValue?.lat ? { coordinates: { lat: locationValue.lat, lng: locationValue.lng } } : {})
            };
            if (addrMode === 'add') {
                await updateProfile({ addAddress: payload });
                toast.success('Address added!');
            } else {
                await updateProfile({ updateAddress: { id: editingId, ...payload } });
                toast.success('Address updated!');
            }
            closeAddrPanel();
        } catch (err) {
            toast.error(err.message || 'Failed to save address');
        } finally {
            setSavingAddr(false);
        }
    };

    const handleDeleteAddress = async (id) => {
        if (!window.confirm('Remove this address?')) return;
        setDeletingId(id);
        try {
            await updateProfile({ removeAddress: id });
            toast.success('Address removed');
        } catch (err) {
            toast.error(err.message || 'Failed to remove address');
        } finally {
            setDeletingId(null);
        }
    };

    const handleSetDefault = async (id) => {
        try {
            await updateProfile({ setDefaultAddress: id });
            toast.success('Default address updated');
        } catch (err) {
            toast.error(err.message || 'Failed to set default');
        }
    };

    const handleDeleteAccount = async () => {
        if (!window.confirm('Deactivate your account? You will be signed out and can create a new account later with this email and phone.')) return;
        setDeletingAccount(true);
        try {
            await deleteAccount();
            toast.success('Your account has been deactivated.');
            navigate('/login', { replace: true });
        } catch (err) {
            toast.error(err.message || 'Failed to deactivate account');
        } finally {
            setDeletingAccount(false);
        }
    };

    /* ────────────────── render ────────────────── */
    if (loading) return <ProfileShimmer />;

    return (
        <div className="container py-4">
            <h1 className="fw-extrabold text-dark mb-1" style={{ fontSize: '2rem' }}>My Profile</h1>
            <div className="mb-4" style={{ width: '152px', height: '4px', background: '#2d6a4f', borderRadius: '2px' }} />

            <div className="row g-4">
                {/* ── Left: profile overview ── */}
                <div className="col-lg-4">
                    <div className="card border-0 shadow-sm rounded-4 bg-white p-4 text-center">
                        {/* Avatar */}
                        <div
                            className="mx-auto mb-3 position-relative"
                            style={{ width: 100, height: 100, cursor: 'pointer' }}
                            onClick={() => !uploadingAvatar && avatarInputRef.current.click()}
                            title="Click to change profile photo"
                        >
                            <div style={{ width: 100, height: 100, borderRadius: '50%', border: '3px solid #2d6a4f', overflow: 'hidden', background: '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {avatarPreview || user?.profileImage?.url ? (
                                    <img src={avatarPreview || resolveImageUrl(user.profileImage.url)} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <span className="fw-bold text-secondary" style={{ fontSize: '2rem' }}>{user?.name?.charAt(0)?.toUpperCase()}</span>
                                )}
                            </div>
                            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: uploadingAvatar ? '#adb5bd' : '#2d6a4f', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                                {uploadingAvatar
                                    ? <div className="spinner-border spinner-border-sm text-white" style={{ width: 14, height: 14, borderWidth: 2 }} role="status" />
                                    : <FaCamera size={12} color="#fff" />}
                            </div>
                        </div>
                        <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />

                        <h4 className="fw-bold mb-1">{user?.name}</h4>
                        {/* <span className="badge text-uppercase mb-4" style={{ background: '#d8f3dc', color: '#2d6a4f', fontSize: '0.7rem', padding: '5px 10px' }}>{user?.role}</span> */}

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
                                    <button onClick={handleRequestOtp} className="btn w-100 fw-bold py-2 d-flex align-items-center justify-content-center gap-2" style={{ background: '#000', color: '#fff', borderRadius: 8 }}>
                                        <FaCheckDouble size={14} /> Verify Phone Number
                                    </button>
                                ) : (
                                    <form onSubmit={handleVerifyOtp} className="text-start bg-light p-3 rounded border">
                                        <label className="form-label small fw-bold text-muted mb-2">Enter 6-digit OTP:</label>
                                        <div className="d-flex gap-2">
                                            <input type="text" maxLength="6" required className="form-control text-center font-monospace" placeholder="999999" value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
                                            <button type="submit" disabled={verifying} className="btn fw-bold" style={{ background: '#000', color: '#fff' }}>
                                                {verifying ? '...' : 'Verify'}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="card border-0 shadow-sm rounded-4 bg-white p-4">
                        <h5 className="fw-bold text-danger mb-2">Deactivate Account</h5>
                        <p className="small text-muted mb-3">Your account data will be retained, but you will be signed out and unable to use this account.</p>
                        <button type="button" disabled={deletingAccount} onClick={handleDeleteAccount} className="btn btn-outline-danger fw-bold px-4 py-2" style={{ borderRadius: 8 }}>
                            {deletingAccount ? 'Deactivating...' : 'Deactivate My Account'}
                        </button>
                    </div>
                </div>

                {/* ── Right: edit info + addresses ── */}
                <div className="col-lg-8 d-flex flex-column gap-4">
                    {/* Personal info */}
                    <div className="card border-0 shadow-sm rounded-4 bg-white p-4">
                        <h5 className="fw-bold mb-4">Edit Personal Information</h5>
                        <form onSubmit={handleSaveInfo}>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold small text-dark mb-1">Full Name</label>
                                    <input type="text" required className="form-control" style={{ background: '#f8f9fa', border: '1px solid #e9ecef' }} value={name} onChange={(e) => setName(e.target.value)} />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label fw-semibold small text-dark mb-1">Phone Number</label>
                                    <input type="tel" required className="form-control" style={{ background: '#f8f9fa', border: '1px solid #e9ecef' }} value={phone} onChange={(e) => setPhone(e.target.value)} />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label fw-semibold small text-dark mb-1">Date of Birth</label>
                                    <input type="date" className="form-control" style={{ background: '#f8f9fa', border: '1px solid #e9ecef' }} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label fw-semibold small text-dark mb-1">Gender</label>
                                    <select className="form-select" style={{ background: '#f8f9fa', border: '1px solid #e9ecef' }} value={gender} onChange={(e) => setGender(e.target.value)}>
                                        <option value="">Prefer not to say</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div className="col-md-4">
                                    <label className="form-label fw-semibold small text-dark mb-1">Alternate Contact</label>
                                    <input type="tel" className="form-control" style={{ background: '#f8f9fa', border: '1px solid #e9ecef' }} value={alternateContact} onChange={(e) => setAlternateContact(e.target.value)} />
                                </div>
                            </div>
                            <button type="submit" disabled={updatingInfo} className="btn fw-bold px-4 py-2 mt-3 d-flex align-items-center gap-2" style={{ background: '#000', color: '#fff', borderRadius: 8 }}>
                                <FaUpload size={14} /> {updatingInfo ? 'Saving...' : 'Save Info'}
                            </button>
                        </form>
                    </div>

                    {/* Saved addresses */}
                    <div className="card border-0 shadow-sm rounded-4 bg-white p-4">
                        <div className="d-flex align-items-center justify-content-between mb-4">
                            <h5 className="fw-bold mb-0">Saved Addresses</h5>
                            <button
                                onClick={openAdd}
                                className="btn btn-sm fw-bold d-flex align-items-center gap-2"
                                style={{ background: '#000', color: '#fff', borderRadius: 8, padding: '6px 14px' }}
                            >
                                <FaPlus size={11} /> Add Address
                            </button>
                        </div>

                        {/* Inline add/edit form */}
                        {addrMode && (
                            <div className="mb-4 p-3 rounded-3 border" style={{ background: '#f8fffe', borderColor: '#b7e4c7 !important' }}>
                                <div className="d-flex align-items-center justify-content-between mb-3">
                                    <span className="fw-bold small text-dark">{addrMode === 'add' ? 'New Address' : 'Edit Address'}</span>
                                    <button type="button" onClick={closeAddrPanel} className="btn btn-sm btn-light p-1"><FaTimes size={12} /></button>
                                </div>
                                <form onSubmit={handleSaveAddress}>
                                    <div className="d-flex flex-wrap gap-2 mb-2">
                                                {LABEL_OPTIONS.map(opt => (
                                                    <button
                                                        key={opt}
                                                        type="button"
                                                        onClick={() => setAddrForm(f => ({ ...f, label: opt }))}
                                                        className="btn btn-sm d-flex align-items-center gap-1"
                                                        style={{
                                                            borderRadius: 20,
                                                            border: '1.5px solid',
                                                            borderColor: addrForm.label === opt ? '#2d6a4f' : '#dee2e6',
                                                            background: addrForm.label === opt ? '#d8f3dc' : '#fff',
                                                            color: addrForm.label === opt ? '#2d6a4f' : '#6c757d',
                                                            fontWeight: addrForm.label === opt ? 700 : 400,
                                                            fontSize: 12,
                                                            padding: '4px 12px'
                                                        }}
                                                    >
                                                        {labelIcon(opt)} {opt}
                                                    </button>
                                                ))}
                                            </div>
                                    <div className="row g-2">
                                        {/* Map picker */}
                                        <div className="col-12">
                                            <label className="form-label fw-semibold small text-dark mb-1">
                                                <FaMapMarkerAlt size={11} className="me-1" /> Search on Map
                                            </label>
                                            <LocationPicker
                                                value={locationValue}
                                                onChange={handleLocationChange}
                                                inputStyle={{ background: '#f8f9fa', border: '1px solid #e9ecef', marginBottom: 0 }}
                                            />
                                        </div>

                                        {/* Address line */}
                                        <div className="col-12">
                                            <label className="form-label fw-semibold small text-dark mb-1">Address Line <span className="text-danger">*</span></label>
                                            <input
                                                type="text"
                                                required
                                                className="form-control"
                                                style={{ background: '#f8f9fa', border: '1px solid #e9ecef' }}
                                                placeholder="Flat / House No., Building, Street..."
                                                value={addrForm.addressLine}
                                                onChange={patchField('addressLine')}
                                            />
                                        </div>

                                        {/* City & State */}
                                        <div className="col-md-6">
                                            <label className="form-label fw-semibold small text-dark mb-1">City</label>
                                            <input type="text" className="form-control" style={{ background: '#f8f9fa', border: '1px solid #e9ecef' }} placeholder="City" value={addrForm.city} onChange={patchField('city')} />
                                        </div>
                                        <div className="col-md-6">
                                            <label className="form-label fw-semibold small text-dark mb-1">State</label>
                                            <input type="text" className="form-control" style={{ background: '#f8f9fa', border: '1px solid #e9ecef' }} placeholder="State" value={addrForm.state} onChange={patchField('state')} />
                                        </div>

                                        {/* Zipcode */}
                                        <div className="col-md-6">
                                            <label className="form-label fw-semibold small text-dark mb-1">ZIP / Postal Code</label>
                                            <input type="text" className="form-control" style={{ background: '#f8f9fa', border: '1px solid #e9ecef' }} placeholder="e.g. 10001" value={addrForm.zipcode} onChange={patchField('zipcode')} />
                                        </div>

                                        {/* ── Save as ── */}
                                        <div className="col-12 mt-1 pt-2 border-top">
                                            <label className="form-label fw-semibold small text-dark mb-1">Save as</label>
                                            {/* Type pills */}
                                            
                                            {/* Custom nickname */}
                                            <input
                                                type="text"
                                                className="form-control"
                                                style={{ background: '#f8f9fa', border: '1px solid #e9ecef' }}
                                                placeholder={`e.g. My ${addrForm.label}, Friend's ${addrForm.label}…`}
                                                value={addrForm.name}
                                                maxLength={40}
                                                onChange={patchField('name')}
                                            />
                                        </div>

                                        <div className="col-12 mt-2 d-flex gap-2">
                                            <button type="submit" disabled={savingAddr} className="btn fw-bold d-flex align-items-center gap-2" style={{ background: '#000', color: '#fff', borderRadius: 8, padding: '8px 18px' }}>
                                                <FaCheck size={12} /> {savingAddr ? 'Saving...' : (addrMode === 'add' ? 'Add Address' : 'Update Address')}
                                            </button>
                                            <button type="button" onClick={closeAddrPanel} className="btn btn-light fw-semibold" style={{ borderRadius: 8, padding: '8px 18px' }}>
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Address list */}
                        {addresses.length === 0 ? (
                            <div className="text-center py-4 text-muted">
                                <FaMapMarkerAlt size={28} className="mb-2 opacity-50" />
                                <p className="small mb-0">No saved addresses yet. Add one to speed up checkout!</p>
                            </div>
                        ) : (
                            <div className="d-flex flex-column gap-3">
                                {addresses.map(addr => (
                                    <div
                                        key={addr._id}
                                        className="d-flex align-items-start justify-content-between p-3 rounded-3"
                                        style={{
                                            background: addr.isDefault ? '#f0fff4' : '#f8f9fa',
                                            border: `1.5px solid ${addr.isDefault ? '#b7e4c7' : '#e9ecef'}`,
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div className="d-flex align-items-start gap-3">
                                            {/* Icon badge */}
                                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: addr.isDefault ? '#d8f3dc' : '#e9ecef', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: addr.isDefault ? '#2d6a4f' : '#6c757d' }}>
                                                {labelIcon(addr.label)}
                                            </div>
                                            <div>
                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                    <span className="badge d-flex align-items-center gap-1" style={{ background: '#e9ecef', color: '#495057', fontSize: '0.65rem', fontWeight: 600 }}>
                                                        {labelIcon(addr.label)} {addr.label || 'Home'}
                                                    </span>
                                                    {addr.isDefault && (
                                                        <span className="badge d-flex align-items-center gap-1" style={{ background: '#d8f3dc', color: '#2d6a4f', fontSize: '0.65rem' }}>
                                                            <FaStar size={8} /> Default
                                                        </span>
                                                    )}
                                                </div>
                                                {addr.name && (
                                                    <div className="fw-bold small text-dark mb-1">{addr.name}</div>
                                                )}
                                                <p className="mb-0 small text-muted lh-sm">
                                                    {addr.addressLine}
                                                    {addr.city && `, ${addr.city}`}
                                                    {addr.state && `, ${addr.state}`}
                                                    {addr.zipcode && ` – ${addr.zipcode}`}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="d-flex align-items-center gap-1 ms-2 flex-shrink-0">
                                            {!addr.isDefault && (
                                                <button
                                                    onClick={() => handleSetDefault(addr._id)}
                                                    className="btn btn-sm"
                                                    title="Set as default"
                                                    style={{ background: 'transparent', color: '#2d6a4f', border: '1px solid #b7e4c7', borderRadius: 6, padding: '4px 8px', fontSize: 11 }}
                                                >
                                                    Set Default
                                                </button>
                                            )}
                                            <button
                                                onClick={() => openEdit(addr)}
                                                className="btn btn-sm btn-light"
                                                title="Edit"
                                                style={{ padding: '5px 8px' }}
                                            >
                                                <FaEdit size={12} color="#555" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteAddress(addr._id)}
                                                disabled={deletingId === addr._id}
                                                className="btn btn-sm"
                                                title="Remove"
                                                style={{ padding: '5px 8px', background: '#fff3f3', border: '1px solid #f8d7da', borderRadius: 6, color: '#dc3545' }}
                                            >
                                                {deletingId === addr._id
                                                    ? <div className="spinner-border spinner-border-sm" style={{ width: 12, height: 12, borderWidth: 2 }} role="status" />
                                                    : <FaTrash size={11} />}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
