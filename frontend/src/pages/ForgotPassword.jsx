import '../styles/ForgotPassword.css';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaEnvelope, FaPhone,FaPhoneAlt, FaArrowLeft } from 'react-icons/fa';
import { toast } from 'react-toastify';
import axios from 'axios';
import { ResetAuthPanel } from './AuthPanel';


const ForgotPassword = () => {
    const navigate = useNavigate();
    const [useEmail, setUseEmail] = useState(true);
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.post(process.env.REACT_APP_API_URL + '/auth/forgot-password', { identifier });
            if (res.data.success) {
                toast.success(res.data.message);
                navigate('/verify-otp', {
                    state: { phone: res.data.phone, identifier, devOtp: res.data.devOtp || null },
                });
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ui-forgotpassword-1" >
            {/* Left - Illustration */}
            <ResetAuthPanel />
            {/* Right - form */}
            <div className="ui-forgotpassword-2" >
                <div className="ui-forgotpassword-3" >
                    <Link className="ui-forgotpassword-4" to="/login" >
                        <FaArrowLeft size={12} /> Back to Login
                    </Link>

                    <div className="ui-forgotpassword-5" >
                        <h2 className="ui-forgotpassword-6" >
                            Forgot <span className="ui-forgotpassword-7" >Password?</span>
                        </h2>
                        <p className="ui-forgotpassword-8" >
                            No worries! Enter your {useEmail ? 'email address' : 'phone number'} and we'll send you a link to reset your password.
                        </p>
                        <div className="ui-forgotpassword-9"  />
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="ui-forgotpassword-10" >
                            <label className="ui-forgotpassword-11" >
                                {useEmail ? 'Email Address' : 'Phone Number'}
                            </label>
                            <div className="ui-forgotpassword-12" >
                                {useEmail ? <FaEnvelope color="#888" size={14} /> : <FaPhoneAlt color="#888" size={14} />}
                                <input className="ui-forgotpassword-13"
                                    type={useEmail ? 'email' : 'tel'}
                                    required
                                    placeholder={useEmail ? 'name@example.com' : '+91 98765 43210'}
                                    value={identifier}
                                    onChange={e => setIdentifier(e.target.value)}

                                />
                            </div>
                            <div className="ui-forgotpassword-14" >
                                <button className="ui-forgotpassword-15" type="button" onClick={() => { setUseEmail(!useEmail); setIdentifier(''); }}
                                    >
                                    {useEmail ? 'Use Phone Number' : 'Use Email'}
                                </button>
                            </div>
                        </div>

                        <button className="ui-forgotpassword-16" type="submit" disabled={loading}
                            >
                            {loading ? 'Sending...' : 'Send Reset Link'} <span className="ui-forgotpassword-17" >→</span>
                        </button>
                    </form>

                    <div className="ui-forgotpassword-18" >
                        <div className="ui-forgotpassword-19"  />
                        <span className="ui-forgotpassword-20" >OR</span>
                        <div className="ui-forgotpassword-21"  />
                    </div>

                    <p className="ui-forgotpassword-22" >
                        Remember your Password?{' '}
                        <Link className="ui-forgotpassword-23" to="/login" >Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

const ForgotIllustration = () => (
    <div className="ui-forgotpassword-24" >
        <div className="ui-forgotpassword-25" >
            {Array.from({ length: 25 }).map((_, i) => (
                <div className="ui-forgotpassword-26" key={i}  />
            ))}
        </div>
        <div className="ui-forgotpassword-27" >
            {/* Lock icons row */}
            <div className="ui-forgotpassword-28" >
                {['📧', '🔒', '🔄'].map((icon, i) => (
                    <div className="ui-forgotpassword-29" key={i} >
                        {icon}
                    </div>
                ))}
            </div>
            {/* Phone mockup placeholder */}
            <div className="ui-forgotpassword-30" >
                <div className="ui-forgotpassword-31" >🏠</div>
                <div className="ui-forgotpassword-32" >OneApp</div>
                <div className="ui-forgotpassword-33" >All Services, One App</div>
                <div className="ui-forgotpassword-34" >
                    <span className="ui-forgotpassword-35" >🔒</span>
                    <span className="ui-forgotpassword-36" >* * * *</span>
                </div>
            </div>
            <div className="ui-forgotpassword-37" >
                <div className="ui-forgotpassword-38" >✓</div>
                <div className="ui-forgotpassword-39" >✓</div>
            </div>
        </div>
    </div>
);

export default ForgotPassword;
