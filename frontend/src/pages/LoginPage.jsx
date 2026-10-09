import '../styles/LoginPage.css';
import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { FaPhone, FaEnvelope, FaLock, FaEye, FaEyeSlash ,FaPhoneAlt} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useGoogleLogin } from '@react-oauth/google';
import AuthPanel from './AuthPanel';
import CountryCodePicker, { DEFAULT_COUNTRY } from '../components/CountryCodePicker';



const GoogleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
);

const LoginPage = () => {
    const { login, googleLogin, isAuthenticated, loading } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const fromPath = location.state?.from?.pathname || '/';

    const [useEmail, setUseEmail] = useState(false);
    const [identifier, setIdentifier] = useState('');
    const [phoneCountry, setPhoneCountry] = useState(DEFAULT_COUNTRY);
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);

    useEffect(() => {
        if (isAuthenticated) navigate(fromPath, { replace: true });
    }, [isAuthenticated, fromPath, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const loginIdentifier = useEmail ? identifier : `${phoneCountry.code}${identifier}`;
        try {
            const user = await login(loginIdentifier, password);
            toast.success('Logged in successfully!');
            if (user?.role === 'technician') navigate('/technician', { replace: true });
        } catch (err) {
            toast.error(err.message || 'Login failed');
        }
    };

    const googleLoginHandler = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                await googleLogin(tokenResponse.access_token);
                toast.success('Logged in with Google!');
            } catch (err) {
                toast.error(err.message || 'Google login failed');
            }
        },
        onError: () => toast.error('Google login failed'),
        scope: 'openid email profile',
    });

    return (
        <div className="ui-loginpage-1" >
            {/* left: Auth Panel */}
            <AuthPanel />
            {/* right: Form */}
            <div className="ui-loginpage-2" >
                <div className="ui-loginpage-3" >

                    {/* Header */}
                    <div className="ui-loginpage-4" >
                        <p className="ui-loginpage-5" >
                            <span className="ui-loginpage-6" >1APP</span> PORTAL
                        </p>
                        <h2 className="ui-loginpage-7" >Welcome Back</h2>
                        <p className="ui-loginpage-8" >Login to your account to continue</p>
                        <div className="ui-loginpage-9"  />
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Phone / Email field */}
                        <div className="ui-loginpage-10" >
                            <label className="ui-loginpage-11" >
                                {useEmail ? 'Email Address' : 'Phone Number'}
                            </label>
                            <div className="ui-loginpage-12" >
                                {useEmail ? (
                                    <>
                                        <FaEnvelope color="#888" size={14} />
                                        <input className="ui-loginpage-13"
                                            type="email"
                                            required
                                            placeholder="name@example.com"
                                            value={identifier}
                                            onChange={e => setIdentifier(e.target.value)}

                                        />
                                    </>
                                ) : (
                                    <>
                                        <FaPhoneAlt color="#888" size={14} />
                                        <CountryCodePicker
                                            selectedCountry={phoneCountry}
                                            onCountryChange={setPhoneCountry}
                                            phoneValue={identifier}
                                            onPhoneChange={setIdentifier}
                                            required
                                        />
                                    </>
                                )}
                            </div>
                            <div className="ui-loginpage-14" >
                                <button className="ui-loginpage-15" type="button" onClick={() => { setUseEmail(!useEmail); setIdentifier(''); }}
                                    >
                                    {useEmail ? 'Use Phone Number' : 'Use Email'}
                                </button>
                            </div>
                        </div>

                        {/* Password field */}
                        <div className="ui-loginpage-16" >
                            <label className="ui-loginpage-17" >Password</label>
                            <div className="ui-loginpage-18" >
                                <FaLock color="#888" size={14} />
                                <input className="ui-loginpage-19"
                                    type={showPass ? 'text' : 'password'}
                                    required
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}

                                />
                                <button className="ui-loginpage-20" type="button" onClick={() => setShowPass(!showPass)}
                                    >
                                    {showPass ? <FaEye size={15} /> : <FaEyeSlash size={15} />}
                                </button>
                            </div>
                            <div className="ui-loginpage-21" >
                                <Link className="ui-loginpage-22" to="/forgot-password" >
                                    Forgot password ?
                                </Link>
                            </div>
                        </div>

                        <button className="ui-loginpage-23" type="submit" disabled={loading} >
                            {loading ? 'Logging in...' : 'Login'} <span className="ui-loginpage-24" >→</span>
                        </button>
                    </form>

                    {/* OR divider */}
                    <div className="ui-loginpage-25" >
                        <div className="ui-loginpage-26"  />
                        <span className="ui-loginpage-27" >OR</span>
                        <div className="ui-loginpage-28"  />
                    </div>

                    <button className="ui-loginpage-29" onClick={() => googleLoginHandler()} >
                        <GoogleIcon />
                        Continue with Google
                    </button>

                    <p className="ui-loginpage-30" >
                        Don't have an account?{' '}
                        <Link className="ui-loginpage-31" to="/signup" >Sign Up</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;