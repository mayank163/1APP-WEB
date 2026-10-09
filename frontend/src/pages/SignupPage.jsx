import { cssValue } from '../utils/cssValue';
import '../styles/SignupPage.css';
import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { FaUser, FaPhone, FaEnvelope, FaLock, FaEye, FaEyeSlash, FaSms ,FaPhoneAlt} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useGoogleLogin } from '@react-oauth/google';
import AuthPanel from './AuthPanel';
import axios from 'axios';
import CountryCodePicker, { DEFAULT_COUNTRY } from '../components/CountryCodePicker';

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
const strengthColor = ['', '#e53935', '#fb8c00', '#fdd835', '#000000'];



const Field = ({ label, icon, children }) => (
    <div className="ui-signuppage-1" >
        <label className="ui-signuppage-2" >{label}</label>
        <div className="ui-signuppage-3" >
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
    const [phoneCountry, setPhoneCountry] = useState(DEFAULT_COUNTRY);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [devOtp, setDevOtp] = useState(null);
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
                await verifyRegister(`${phoneCountry.code}${phone}`, otp);
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

        if (phone.length < phoneCountry.maxDigits) {
            toast.error(`Phone number must be ${phoneCountry.maxDigits} digits for ${phoneCountry.name}`);
            return;
        }

        const fullPhone = `${phoneCountry.code}${phone}`;

        try {
            const res = await startRegister({ name, email, phone: fullPhone, password });
            setDevOtp(res.devOtp || null);
            setRegistrationStep('otp');
            toast.success('OTP sent. Verify your phone to create your account.');
        } catch (err) {
            toast.error(err.message || 'Registration failed');
        }
    };

    const editDetails = () => {
        setOtp('');
        setDevOtp(null);
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
        <div className="ui-signuppage-4" >
            <AuthPanel />

            <div className="ui-signuppage-5" >
                <div className="ui-signuppage-6" >
                    <div className="ui-signuppage-7" >
                        <p className="ui-signuppage-8" >
                            <span className="ui-signuppage-9" >1APP</span> Portal
                        </p>
                        <h2 className="ui-signuppage-10" >Create Account</h2>
                        <p className="ui-signuppage-11" >
                            {registrationStep === 'details' ? 'Enter your details to receive an OTP' : 'Verify OTP to finish signup'}
                        </p>
                        <div className="ui-signuppage-12"  />
                    </div>

                    <form onSubmit={handleSubmit}>
                        {registrationStep === 'details' ? (
                            <>
                                <Field label="Full Name" icon={<FaUser color="#888" size={14} />}>
                                    <input className="ui-signuppage-13" type="text" required placeholder="John Doe" value={name}
                                        onChange={e => setName(e.target.value)}  />
                                </Field>

                                <Field label="Phone Number" icon={<FaPhoneAlt color="#888" size={14} />}>
                                    <CountryCodePicker
                                        selectedCountry={phoneCountry}
                                        onCountryChange={setPhoneCountry}
                                        phoneValue={phone}
                                        onPhoneChange={setPhone}
                                        required
                                    />
                                </Field>

                                <Field label="Email Address" icon={<FaEnvelope color="#888" size={14} />}>
                                    <input className="ui-signuppage-14" type="email" required placeholder="name@example.com" value={email}
                                        onChange={e => setEmail(e.target.value)}  />
                                </Field>

                                <div className="ui-signuppage-15" >
                                    <label className="ui-signuppage-16" >Password</label>
                                    <div className="ui-signuppage-17" >
                                        <FaLock color="#888" size={14} />
                                        <input className="ui-signuppage-18" type={showPass ? 'text' : 'password'} required placeholder="Password"
                                            value={password} onChange={e => setPassword(e.target.value)}
                                             />
                                        <button className="ui-signuppage-19" type="button" onClick={() => setShowPass(!showPass)}
                                            >
                                            {showPass ? <FaEye size={15} /> : <FaEyeSlash size={15} />}
                                        </button>
                                    </div>
                                    <div className="ui-signuppage-20" >
                                        <div className="ui-signuppage-21" >
                                            {[1, 2, 3, 4].map(i => (
                                                <div className="ui-signuppage-22" key={i} style={{ "--ui-signuppage-22-background": cssValue(password && i <= strength ? strengthColor[strength] : "var(--ui-color-26)", "background") }} />
                                            ))}
                                        </div>
                                        {password && (
                                            <div className="ui-signuppage-23" style={{ "--ui-signuppage-23-color": cssValue(strengthColor[strength], "color") }}>
                                                {strengthLabel[strength]} password
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="ui-signuppage-24" >
                                    <div className="ui-signuppage-25" >Verify your phone</div>
                                    <div className="ui-signuppage-26" >OTP sent to {phoneCountry.code} {phone}</div>
                                    <button className="ui-signuppage-27" type="button" onClick={editDetails} >
                                        Edit details
                                    </button>
                                </div>

                                <Field label="OTP Code" icon={<FaSms color="#888" size={14} />}>
                                    <input className="ui-signuppage-28" type="text" inputMode="numeric" maxLength="6" required placeholder="Enter 6-digit OTP" value={otp}
                                        onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}  />
                                </Field>

                                {/* Dev-mode OTP hint */}
                                {devOtp && (
                                    <div className="ui-signuppage-29" >
                                        <div className="ui-signuppage-30" >
                                            <span className="ui-signuppage-31" >
                                                Dev mode · OTP
                                            </span>
                                            <span className="ui-signuppage-32" >
                                                {devOtp}
                                            </span>
                                        </div>
                                        <button className="ui-signuppage-33"
                                            type="button"
                                            title="Auto-fill OTP"
                                            onClick={() => setOtp(devOtp)}

                                        >
                                            Auto-fill
                                        </button>
                                    </div>
                                )}
                            </>
                        )}

                        <button className="ui-signuppage-34" type="submit" disabled={loading} >
                            {registrationStep === 'details' ? <FaUser size={14} /> : <FaSms size={14} />}
                            {loading
                                ? (registrationStep === 'details' ? 'Sending OTP...' : 'Verifying OTP...')
                                : (registrationStep === 'details' ? 'Send OTP' : 'Verify & Create Account')}
                            <span className="ui-signuppage-35" >→</span>
                        </button>
                    </form>

                    <div className="ui-signuppage-36" >
                        <div className="ui-signuppage-37"  />
                        <span className="ui-signuppage-38" >OR</span>
                        <div className="ui-signuppage-39"  />
                    </div>

                    <button className="ui-signuppage-40" onClick={() => googleLogin()} >
                        <GoogleIcon />
                        Continue with Google
                    </button>

                    <p className="ui-signuppage-41" >
                        Already have an account?{' '}
                        <Link className="ui-signuppage-42" to="/login" >Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;
