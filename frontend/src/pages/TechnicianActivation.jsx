import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import API from '../services/api';
import './TechnicianActivation.css';
export default function TechnicianActivation() {
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    phone: params.get('phone') || '',
    name: '',
    email: '',
    otp: '',
    password: '',
    confirmPassword: ''
  });
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (key, value) => {
    setForm(prev => ({
      ...prev,
      [key]: value
    }));
    setError('');
  };
  const send = async () => {
    setBusy(true);
    setError('');
    try {
      await API.post('/technician-auth/activation/send-otp', {
        phone: form.phone
      });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const submit = async e => {
    e.preventDefault();
    if (!sent) return send();
    setBusy(true);
    setError('');
    try {
      await API.post('/technician-auth/activation/complete', form);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not activate your account. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return <main className="tech-activation"><section><span className="tech-activation-brand">1APP</span><h1>{done ? 'You’re ready to get started' : 'Activate your technician account'}</h1>{done ? <><p>Your mobile number is verified and your password has been saved. Sign in with your registered email or mobile number in the technician app.</p><Link to="/login">Go to sign in</Link></> : <><p>Verify your mobile number to join the team.</p><form onSubmit={submit}>
    {error && <div className="tech-activation-error" role="alert">{error}</div>}
    <label>Mobile number<input type="tel" required value={form.phone} readOnly={sent} placeholder="+91 98765 43210" onChange={e => update('phone', e.target.value)} autoComplete="tel" /></label>
    {sent && <><p role="status">OTP sent to {form.phone}. It expires in 5 minutes.</p><div className="tech-activation-links"><button type="button" disabled={busy} onClick={() => {
                setSent(false);
                update('otp', '');
              }}>Change number</button><button type="button" disabled={busy} onClick={send}>Resend OTP</button></div>
      <label>Verification code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={form.otp} onChange={e => update('otp', e.target.value)} placeholder="6-digit code" /></label>
      <label>Full name<input required value={form.name} maxLength={120} onChange={e => update('name', e.target.value)} autoComplete="name" /></label>
      <label>Email address (optional)<input type="email" value={form.email} onChange={e => update('email', e.target.value)} autoComplete="email" /></label>
      <label>Password<input type="password" required minLength={8} value={form.password} onChange={e => update('password', e.target.value)} autoComplete="new-password" placeholder="At least 8 characters" /></label>
      <label>Confirm password<input type="password" required minLength={8} value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} autoComplete="new-password" /></label>
    </>}
    <button className="tech-activation-submit" disabled={busy}>{busy ? 'Please wait…' : sent ? 'Activate Account' : 'Send OTP'}</button>
  </form></>}</section></main>;
}
