import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { FaUser, FaPhone, FaEnvelope, FaLock, FaEye, FaEyeSlash, FaSms } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useGoogleLogin } from '@react-oauth/google';
import AuthPanel from './AuthPanel';
import axios from 'axios';

const getStrength = (pwd) => {
    if (!pwd) return 0;
    let s = 0;
    if (pwd.length >= 8) s++;
    if (/[A-Z]/.test(pwd)) s++;
    if (/[0-9]/.test(pwd)) s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    return s;
};

const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const strengthColor = ['', '#e53935', '#fb8c00', '#fdd835', '#2d7a3a'];

const inputStyle = { border: 'none', outline: 'none', flex: 1, fontSize: '0.95rem', background: 'transparent' };

const Field = ({ label, icon, children }) => (
    <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 700, fontSize: '0.85rem', display: 'block', marginBottom: 6, color: '#1a1a1a' }}>{label}</label>
        <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #ccc', borderRadius: 8, padding: '10px 14px', gap: 10 }}>
            {icon}
            {children}
        </div>
    </div>
);

const GoogleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
);

const SignupPage = () => {
    const { startRegister, verifyRegister, isAuthenticated, loading } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const fromPath = location.state?.from?.pathname || '/';

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [registrationStep, setRegistrationStep] = useState('details');
    const [showPass, setShowPass] = useState(false);
    const strength = getStrength(password);

    useEffect(() => {
        if (isAuthenticated) navigate(fromPath, { replace: true });
    }, [isAuthenticated, fromPath, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (registrationStep === 'otp') {
            if (!otp.trim()) {
                toast.error('Please enter the OTP');
                return;
            }

            try {
                await verifyRegister(phone, otp);
                toast.success('Phone verified. Account created!');
            } catch (err) {
                toast.error(err.message || 'OTP verification failed');
            }
            return;
        }

        if (!name.trim() || !phone.trim() || !email.trim() || !password.trim()) {
            toast.error('All fields are required');
            return;
        }

        try {
            await startRegister({ name, email, phone, password });
            setRegistrationStep('otp');
            toast.success('OTP sent. Verify your phone to create your account.');
        } catch (err) {
            toast.error(err.message || 'Registration failed');
        }
    };

    const editDetails = () => {
        setOtp('');
        setRegistrationStep('details');
    };

    const googleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                setName(data.name || '');
                setEmail(data.email || '');
                setRegistrationStep('details');
                toast.info('Google details added. Enter phone and password to receive OTP.');
            } catch {
                toast.error('Google signup failed');
            }
        },
        onError: () => toast.error('Google signup failed'),
        scope: 'openid email profile',
    });

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh' }}>
            <AuthPanel />

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 56px', background: '#fff' }}>
                <div style={{ maxWidth: 420, width: '100%', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 28 }}>
                        <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#1a1a1a', marginBottom: 2 }}>
                            <span style={{ color: '#2d7a3a' }}>1APP</span> Portal
                        </p>
                        <h2 style={{ fontWeight: 800, fontSize: '1.9rem', color: '#2d7a3a', margin: '4px 0 6px' }}>Create Account</h2>
                        <p style={{ color: '#888', fontSize: '0.9rem', margin: 0 }}>
                            {registrationStep === 'details' ? 'Enter your details to receive an OTP' : 'Verify OTP to finish signup'}
                        </p>
                        <div style={{ width: 40, height: 3, background: '#2d7a3a', margin: '10px auto 0', borderRadius: 2 }} />
                    </div>

                    <form onSubmit={handleSubmit}>
                        {registrationStep === 'details' ? (
                            <>
                                <Field label="Full Name" icon={<FaUser color="#888" size={14} />}>
                                    <input type="text" required placeholder="John Doe" value={name}
                                        onChange={e => setName(e.target.value)} style={inputStyle} />
                                </Field>

                                <Field label="Phone Number" icon={<FaPhone color="#888" size={14} />}>
                                    <input type="tel" required placeholder="+91 98765 43210" value={phone}
                                        onChange={e => setPhone(e.target.value)} style={inputStyle} />
                                </Field>

                                <Field label="Email Address" icon={<FaEnvelope color="#888" size={14} />}>
                                    <input type="email" required placeholder="name@example.com" value={email}
                                        onChange={e => setEmail(e.target.value)} style={inputStyle} />
                                </Field>

                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ fontWeight: 700, fontSize: '0.85rem', display: 'block', marginBottom: 6, color: '#1a1a1a' }}>Password</label>
                                    <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #ccc', borderRadius: 8, padding: '10px 14px', gap: 10 }}>
                                        <FaLock color="#888" size={14} />
                                        <input type={showPass ? 'text' : 'password'} required placeholder="Password"
                                            value={password} onChange={e => setPassword(e.target.value)}
                                            style={{ ...inputStyle, flex: 1 }} />
                                        <button type="button" onClick={() => setShowPass(!showPass)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#aaa', display: 'flex' }}>
                                            {showPass ? <FaEye size={15} /> : <FaEyeSlash size={15} />}
                                        </button>
                                    </div>
                                    <div style={{ marginTop: 8 }}>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {[1, 2, 3, 4].map(i => (
                                                <div key={i} style={{
                                                    flex: 1, height: 4, borderRadius: 2,
                                                    background: password && i <= strength ? strengthColor[strength] : '#e0e0e0',
                                                    transition: 'background 0.3s'
                                                }} />
                                            ))}
                                        </div>
                                        {password && (
                                            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: strengthColor[strength], fontWeight: 600, marginTop: 3 }}>
                                                {strengthLabel[strength]} password
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ background: '#f5fbf6', border: '1px solid #d7eadb', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                                    <div style={{ color: '#2d7a3a', fontWeight: 800, fontSize: '0.9rem' }}>Verify your phone</div>
                                    <div style={{ color: '#555', fontSize: '0.85rem', marginTop: 4 }}>OTP sent to {phone}</div>
                                    <button type="button" onClick={editDetails} style={{ background: 'none', border: 'none', color: '#2d7a3a', fontWeight: 700, padding: '8px 0 0', cursor: 'pointer' }}>
                                        Edit details
                                    </button>
                                </div>

                                <Field label="OTP Code" icon={<FaSms color="#888" size={14} />}>
                                    <input type="text" inputMode="numeric" maxLength="6" required placeholder="Enter 6-digit OTP" value={otp}
                                        onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} style={inputStyle} />
                                </Field>
                            </>
                        )}

                        <button type="submit" disabled={loading} style={{
                            width: '100%', background: '#2d7a3a', color: '#fff', border: 'none',
                            borderRadius: 8, padding: '13px', fontWeight: 700, fontSize: '1rem',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            marginTop: 4
                        }}>
                            {registrationStep === 'details' ? <FaUser size={14} /> : <FaSms size={14} />}
                            {loading
                                ? (registrationStep === 'details' ? 'Sending OTP...' : 'Verifying OTP...')
                                : (registrationStep === 'details' ? 'Send OTP' : 'Verify & Create Account')}
                            <span style={{ fontSize: '1.1rem' }}>→</span>
                        </button>
                    </form>

                    <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: 10 }}>
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

                    <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.88rem', color: '#555' }}>
                        Already have an account?{' '}
                        <Link to="/login" style={{ color: '#2d7a3a', fontWeight: 700, textDecoration: 'none' }}>Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;
