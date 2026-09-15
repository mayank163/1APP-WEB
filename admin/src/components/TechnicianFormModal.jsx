import React, { useState } from 'react';
import { Modal } from 'react-bootstrap';
import { FiArrowLeft, FiArrowRight, FiCheck, FiUpload, FiAlertTriangle, FiX, FiPhone, FiMail } from 'react-icons/fi';
import adminApi from '../services/adminApi';
export const DEFAULT_TRADES = ['Electrical', 'Plumbing', 'Home Services', 'Carpentry', 'Painting', 'Appliance Repair', 'AC Repairs'];
const documents = [['profilePhoto', 'Profile Photo'], ['drivingLicenseFront', 'ID Proof'], ['residentialProof', 'Address Proof'], ['cvResume', 'Other Document']];
const initial = {
  name: '',
  phone: '',
  email: '',
  dateOfBirth: '',
  primaryService: '',
  yearsOfExperience: '',
  serviceArea: '',
  serviceRadius: 15,
  skills: '',
  sendSms: false,
  sendEmail: false
};
export const errorMessage = error => error.response?.data?.message || error.message || 'Something went wrong. Please try again.';
const displayDate = value => value ? new Date(value).toLocaleDateString('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
}) : 'Not provided';
export function DetailList({
  items
}) {
  return <dl className="to-detail-list">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not provided'}</dd></div>)}</dl>;
}
export default function TechnicianFormModal({
  onClose,
  onSaved,
  technician,
  trades = DEFAULT_TRADES
}) {
  const editing = !!technician;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => technician ? {
    ...initial,
    ...technician,
    skills: technician.skills.join(', '),
    dateOfBirth: technician.dateOfBirth?.slice(0, 10) || ''
  } : initial);
  const [files, setFiles] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const update = (key, value) => {
    setForm(prev => ({
      ...prev,
      [key]: value,
      ...(key === 'email' && !value ? {
        sendEmail: false
      } : {})
    }));
    setError('');
  };
  const close = () => {
    if (!busy) onClose();
  };
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      if (editing) {
        await adminApi.updateTechnician(technician._id, form);
        onSaved();
        onClose();
      } else {
        const payload = new FormData();
        Object.entries(form).forEach(([key, value]) => payload.append(key, value));
        Object.entries(files).forEach(([key, value]) => {
          if (value) payload.append(key, value);
        });
        const response = await adminApi.createTechnician(payload);
        setResult(response.data || response);
        onSaved();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const next = event => {
    event.preventDefault();
    if (step === 1 && !/^(?:\+[1-9]\d{7,14}|\d{10})$/.test(form.phone.replace(/[\s()-]/g, ''))) return setError('Enter a valid mobile number, including its country code.');
    if (step === 2 && editing) return save();
    setError('');
    setStep(step + 1);
  };
  const selectFile = (key, file) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', ...(key === 'profilePhoto' ? [] : ['application/pdf'])];
    if (!allowed.includes(file.type) || file.size > 5 * 1024 * 1024) return setError('Use JPG, PNG, WebP or PDF files up to 5 MB. Profile photos must be images.');
    setFiles(prev => ({
      ...prev,
      [key]: file
    }));
    setError('');
  };
  const field = (key, label, type = 'text', props = {}) => <label className="to-field" key={key}><span>{label}{props.required && <b> *</b>}</span><input type={type} value={form[key]} onChange={e => update(key, e.target.value)} {...props} /></label>;
  const basic = [['Full Name', form.name], ['Mobile Number', form.phone], ['Email Address', form.email], ['Date of Birth', displayDate(form.dateOfBirth)]];
  const professional = [['Service / Trade', form.primaryService], ['Experience', `${form.yearsOfExperience || 0} years`], ['Service Area', form.serviceArea ? `${form.serviceArea} (${form.serviceRadius} km radius)` : 'Not provided'], ['Skills / Services', form.skills]];
  return <Modal show onHide={close} centered backdrop={busy ? 'static' : true} keyboard={!busy} dialogClassName={`to-modal ${result ? 'to-success-modal' : ''}`} aria-labelledby="to-form-title">
    {result ? <div className="to-success-content">
      <div className="to-confetti" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <div className="to-success-check"><FiCheck /></div>
      <h2 id="to-form-title">Technician Added Successfully!</h2>
      <p><strong>{result.technician.name}</strong> has been added.</p>
      <div className="to-success-summary"><DetailList items={[["Technician ID", result.technician.technicianId], ['Status', <span className="to-badge to-badge-invited">Pending Activation</span>]]} /></div>
      <div className="to-delivery-results">
        {result.delivery.length === 0 ? <p>No invitation was requested. You can send one using Invite Technician.</p> : <><p>Activation invitation delivery</p>{result.delivery.map(d => <div key={d.channel}>{d.channel === 'sms' ? <FiPhone /> : <FiMail />}<span>{d.target}</span><span className={d.status === 'failed' ? 'to-text-danger' : 'to-text-success'}>{d.status === 'sent' ? 'Sent' : 'Failed — retry using Invite Technician'}</span></div>)}</>}
      </div>
      <button type="button" className="to-btn-outline" onClick={close}>Done</button>
    </div> : <>
      <Modal.Header><Modal.Title id="to-form-title">{editing ? 'Edit Technician' : step === 5 ? 'Review Details' : 'Add Technician'}</Modal.Title><button type="button" className="to-icon-btn" aria-label="Close" onClick={close} disabled={busy}><FiX /></button></Modal.Header>
      <form onSubmit={step === 5 ? e => {
        e.preventDefault();
        save();
      } : next}>
        <Modal.Body>
          {step < 5 && <div className="to-step-row"><span>Step {step} of {editing ? 2 : 4}</span><div className="to-steps" aria-label={`Step ${step} of ${editing ? 2 : 4}`}>{Array.from({
                length: editing ? 2 : 4
              }, (_, i) => <React.Fragment key={i}>{i > 0 && <i className={step > i ? 'complete' : ''} />}<span className={step === i + 1 ? 'current' : step > i + 1 ? 'complete' : ''}>{step > i + 1 ? <FiCheck /> : i + 1}</span></React.Fragment>)}</div></div>}
          {error && <div className="to-alert to-error" role="alert">{error}</div>}
          {step === 1 && <><h3>Basic Information</h3><p className="to-muted">Add basic personal details of the technician.</p><div className="to-form-grid">
            {field('name', 'Full Name', 'text', {
                required: true,
                placeholder: 'Enter full name',
                maxLength: 120
              })}
            {field('phone', 'Mobile Number', 'tel', {
                required: true,
                placeholder: '+91 98765 43210',
                autoComplete: 'tel'
              })}
            {field('email', 'Email Address', 'email', {
                placeholder: 'Enter email address'
              })}
            {field('dateOfBirth', 'Date of Birth', 'date', {
                max: new Date().toISOString().slice(0, 10)
              })}
            <label className="to-field to-span-2"><span>Primary Service / Trade <b>*</b></span><select required value={form.primaryService} onChange={e => update('primaryService', e.target.value)}><option value="">Select service or trade</option>{[...new Set([...trades, form.primaryService].filter(Boolean))].map(t => <option key={t}>{t}</option>)}</select></label>
          </div></>}
          {step === 2 && <><h3>Professional Details</h3><p className="to-muted">Add experience, service area and skills.</p><div className="to-form-grid">
            {field('yearsOfExperience', 'Years of Experience', 'number', {
                min: 0,
                max: 80,
                step: '0.5',
                placeholder: 'e.g. 5'
              })}
            {field('serviceRadius', 'Service Radius (km)', 'number', {
                min: 1,
                max: 500,
                required: true
              })}
            <div className="to-span-2">{field('serviceArea', 'Service Area', 'text', {
                  placeholder: 'e.g. Chandigarh',
                  maxLength: 200
                })}</div>
            <label className="to-field to-span-2"><span>Skills / Services</span><textarea value={form.skills} onChange={e => update('skills', e.target.value)} placeholder="Wiring, installation, repair" rows={3} /><small>Separate skills with commas.</small></label>
          </div></>}
          {step === 3 && <><h3>Documents (Optional)</h3><p className="to-muted">Upload available documents. You can upload later also.</p><div className="to-upload-list">{documents.map(([key, label]) => <div className="to-upload-row" key={key}><div><strong>{label}</strong><small>{files[key]?.name || 'Optional'}</small></div><div className="to-upload-actions">{files[key] && <button type="button" className="to-icon-btn" aria-label={`Remove ${label}`} onClick={() => setFiles(prev => ({
                    ...prev,
                    [key]: null
                  }))}><FiX /></button>}<label className="to-btn-outline to-upload-button"><FiUpload /> {files[key] ? 'Replace' : 'Upload'}<input type="file" aria-label={`Upload ${label}`} accept={key === 'profilePhoto' ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,application/pdf'} onChange={e => {
                      selectFile(key, e.target.files[0]);
                      e.target.value = '';
                    }} /></label></div></div>)}</div><small className="to-muted">JPG, PNG, WebP or PDF · Maximum 5 MB per file</small></>}
          {step === 4 && <><h3>Access &amp; Invitation</h3><p className="to-muted">Choose how to invite the technician to activate their account.</p><div className="to-alert"><FiAlertTriangle /><div><strong>The technician can verify their mobile number after creation.</strong><p>Their account is created immediately. Activation requires a mobile OTP and a password.</p></div></div><label className="to-field"><span>Account Status</span><select value="invited" disabled><option value="invited">Pending Activation</option></select></label><div className="to-checkbox-list"><label><input type="checkbox" checked={form.sendSms} onChange={e => update('sendSms', e.target.checked)} /><span>Send SMS invitation<small>Technician will receive an SMS with an activation link.</small></span></label><label><input type="checkbox" checked={form.sendEmail} disabled={!form.email} onChange={e => update('sendEmail', e.target.checked)} /><span>Send Email invitation<small>{form.email ? 'Technician will receive an email with an activation link.' : 'Add an email address in Basic Information to enable.'}</small></span></label></div></>}
          {step === 5 && <><p className="to-muted">Please review the details before creating technician.</p><h4>Basic Information</h4><DetailList items={basic} /><h4>Professional Details</h4><DetailList items={professional} /><h4>Documents</h4><DetailList items={[["Uploaded", `${Object.values(files).filter(Boolean).length} Documents`]]} /></>}
        </Modal.Body>
        <Modal.Footer><button type="button" className="to-btn-neutral" disabled={busy} onClick={step === 1 ? close : () => {
            setError('');
            setStep(step - 1);
          }}>{step === 1 ? 'Cancel' : <><FiArrowLeft /> Back</>}</button><div className="to-footer-actions">{step === 3 && <button type="button" className="to-btn-outline" onClick={() => {
              setFiles({});
              setError('');
              setStep(4);
            }}>Skip <FiArrowRight /></button>}<button type="submit" className="to-btn-primary" disabled={busy}>{busy ? 'Saving…' : step === 5 ? 'Create Technician' : editing && step === 2 ? 'Save Changes' : step === 4 ? 'Review' : 'Next'}{!busy && step < 5 && <FiArrowRight />}</button></div></Modal.Footer>
      </form>
    </>}
  </Modal>;
}
