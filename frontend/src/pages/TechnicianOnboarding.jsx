import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import { COUNTRIES } from '../components/CountryCodePicker';
import '../styles/TechnicianOnboarding.css';

const initialForm = { name: '', phone: '', email: '', address: '', serviceRadius: '15', yearsOfExperience: '', consent: false };

export default function TechnicianOnboarding() {
  const [form, setForm] = useState(initialForm);
  const [country, setCountry] = useState(COUNTRIES.find(item => item.name === 'United States'));
  const fullPhone = `${country.code}${form.phone.replace(/\D/g, '')}`;
  const [files, setFiles] = useState({});
  const updateFile = event => {
    const file = event.target.files[0];
    setFiles(previous => ({ ...previous, [event.target.name]: file }));
    setError(file && file.size > 5 * 1024 * 1024 ? 'Each file must be 5 MB or smaller.' : '');
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const update = event => {
    const { name, value, type, checked } = event.target;
    setForm(previous => ({ ...previous, [name]: name === 'phone' ? value.replace(/\D/g, '').slice(0, country.maxDigits) : type === 'checkbox' ? checked : value }));
    setError('');
  };
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    if (![form.name, form.email, form.phone, form.address, form.serviceRadius, form.yearsOfExperience].every(value => String(value).trim()) || !files.drivingLicenseFront || !form.consent) {
      setError('Please complete all fields, upload your driving licence, and accept the terms.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (form.phone.length !== country.maxDigits || fullPhone.length > 16) {
        setError(`Enter exactly ${country.maxDigits} digits for ${country.code}.`); return;
      }
      const data = new FormData();
      Object.entries(form).forEach(([key, value]) => data.append(key, key === 'phone' ? fullPhone : value));
      for (const [key, file] of Object.entries(files)) {
        if (file?.size > 5 * 1024 * 1024) { setError('Each file must be 5 MB or smaller.'); return; }
        if (file) data.append(key, file);
      }
      await API.post('/technician-auth/preregister', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'We could not save your details. Please try again.');
    } finally { setBusy(false); }
  };
  if (done) {
    return <section className="tech-onboarding-thankyou" role="status">
      <h1>Thank you!</h1>
      <p>Your technician registration has been submitted successfully.</p>
    </section>;
  }
  return <section className="tech-onboarding">
    <div className="tech-onboarding-intro">
      <span className="tech-onboarding-eyebrow">SOS • TECHNICIAN REGISTRATION</span>
      <h1>Your skills.<br />A new opportunity.</h1>
      <p>Register your interest in joining our technician network before the app launches.</p>
      <ol><li>Tell us about yourself and your work.</li><li>When the app launches, enter your registered phone number or email.</li><li>Verify your OTP and sign in. Your details will already be there.</li></ol>
      <p>No password or OTP is needed today. Profile and document approval will be required before you can receive eligible jobs.</p>
    </div>
    <div className="tech-onboarding-card">
        <h2>Join as a technician</h2><p>All fields are required. Verify your account when you’re ready to use the app.</p>
        <form onSubmit={submit}>
          {error && <div className="tech-onboarding-error" role="alert">{error}</div>}
          <fieldset disabled={busy}>
            <div className="tech-onboarding-fields">
              <label>Full name<input name="name" autoComplete="name" required maxLength={120} value={form.name} onChange={update} /></label>
              <div className="tech-onboarding-phone-field">
                <label htmlFor="onboarding-phone">Mobile number</label>
                <div className="tech-onboarding-phone-row">
                  <select required aria-label="Country calling code" value={country.code} onChange={event => { const selected = COUNTRIES.find(item => item.code === event.target.value); setCountry(selected); setForm(previous => ({ ...previous, phone: previous.phone.slice(0, selected.maxDigits) })); setError(''); }}>
                    {COUNTRIES.filter((item, index, all) => all.findIndex(country => country.code === item.code) === index).map(item => <option key={item.code} value={item.code}>{item.flag} {item.code}</option>)}
                  </select>
                  <input id="onboarding-phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" required minLength={country.maxDigits} maxLength={country.maxDigits} pattern={`[0-9]{${country.maxDigits}}`} title={`Enter exactly ${country.maxDigits} digits`} placeholder={`${country.maxDigits}-digit number`} value={form.phone} onChange={update} />
                </div>
                
              </div>
              <label>Email address<input name="email" required type="email" autoComplete="email" maxLength={254} value={form.email} onChange={update} /><small>You can also use this email for OTP sign-in.</small></label>
              <label>Address<input name="address" autoComplete="street-address" required maxLength={500} placeholder="Street, city, state and postal code" value={form.address} onChange={update} /></label>
              <label>Service radius (miles)<input name="serviceRadius" type="number" required min="1" max="500" step="1" value={form.serviceRadius} onChange={update} /></label>
              <label>Years of experience<input name="yearsOfExperience" type="number" required min="0" max="80" step="0.5" value={form.yearsOfExperience} onChange={update} /></label>
            </div>
            <label>Driving licence<input name="drivingLicenseFront" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" onChange={updateFile} /><small>JPG, PNG, WebP or PDF. Maximum 5 MB.</small></label>
            {/* <label className="tech-onboarding-consent"><input name="consent" type="checkbox" required checked={form.consent} onChange={update} /><span>I agree to the <Link to="/terms">Terms & Conditions</Link> and <Link to="/privacy-policy">Privacy Policy</Link>, and to saving my details for technician onboarding.</span></label> */}
            <button type="submit">{busy ? 'Saving your details…' : 'Register your interest'}</button>
          </fieldset>
        </form>
    </div>
  </section>;
}
