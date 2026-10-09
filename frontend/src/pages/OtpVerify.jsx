import { cssValue } from '../utils/cssValue';
import '../styles/OtpVerify.css';
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaArrowLeft } from 'react-icons/fa';
import { ResetAuthPanel } from './AuthPanel';

const OtpVerify = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { phone, identifier, devOtp } = location.state || {};
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const inputs = useRef([]);

    useEffect(() => {
        if (!phone) navigate('/forgot-password');
    }, [phone, navigate]);

    const handleChange = (val, idx) => {
        if (!/^\d?$/.test(val)) return;
        const next = [...otp];
        next[idx] = val;
        setOtp(next);
        if (val && idx < 5) inputs.current[idx + 1]?.focus();
    };

    const handleKeyDown = (e, idx) => {
        if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
            inputs.current[idx - 1]?.focus();
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const code = otp.join('');
        if (code.length < 6) {
            toast.error('Please enter the 6-digit OTP');
            return;
        }
        navigate('/reset-password', { state: { phone, otp: code, identifier } });
    };

    const maskedPhone = phone ? `******${phone.slice(-4)}` : '';

    return (
        <div className="ui-otpverify-1" >
            {/* Left - Form */}
            <div className="ui-otpverify-2" >
                <div className="ui-otpverify-3" >
                    <Link className="ui-otpverify-4" to="/forgot-password" >
                        <FaArrowLeft size={12} /> Back
                    </Link>

                    <div className="ui-otpverify-5" >
                        <h2 className="ui-otpverify-6" >
                            Verify <span className="ui-otpverify-7" >OTP</span>
                        </h2>
                        <p className="ui-otpverify-8" >
                            We've sent a 6-digit OTP to your registered phone{' '}
                            <strong className="ui-otpverify-9" >{maskedPhone}</strong>
                        </p>
                        <div className="ui-otpverify-10"  />
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="ui-otpverify-11" >
                            {otp.map((digit, idx) => (
                                <input className="ui-otpverify-12"
                                    key={idx}
                                    ref={el => inputs.current[idx] = el}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={e => handleChange(e.target.value, idx)}
                                    onKeyDown={e => handleKeyDown(e, idx)}
                                    style={{ "--ui-otpverify-12-border": cssValue(`2px solid ${digit ? '#000000' : '#ddd'}`, "border") }}
                                />
                            ))}
                        </div>

                        {/* Dev-mode OTP hint — only shown when Twilio SMS is off */}
                        {devOtp && (
                            <div className="ui-otpverify-13" >
                                <div className="ui-otpverify-14" >
                                    <span className="ui-otpverify-15" >
                                        Dev mode · OTP
                                    </span>
                                    <span className="ui-otpverify-16" >
                                        {devOtp}
                                    </span>
                                </div>
                                <button className="ui-otpverify-17"
                                    type="button"
                                    title="Auto-fill OTP"
                                    onClick={() => {
                                        const digits = devOtp.split('');
                                        setOtp(digits);
                                        inputs.current[5]?.focus();
                                    }}

                                >
                                    Auto-fill
                                </button>
                            </div>
                        )}

                        <button className="ui-otpverify-18" type="submit"
                            >
                            Verify OTP <span className="ui-otpverify-19" >→</span>
                        </button>
                    </form>

                    <p className="ui-otpverify-20" >
                        Remember your Password?{' '}
                        <Link className="ui-otpverify-21" to="/login" >Sign In</Link>
                    </p>
                </div>
            </div>
            {/* Right - Illustration */}
            <ResetAuthPanel />

        </div>
    );
};

export default OtpVerify;
