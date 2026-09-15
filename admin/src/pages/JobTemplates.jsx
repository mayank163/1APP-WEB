import React, { useCallback, useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { FaPlus, FaEye, FaEdit, FaTrash, FaSearch } from 'react-icons/fa';
import { toast } from 'react-toastify';
import adminApi from '../services/adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';
import JobForm from '../components/TechnicianJobForm';
import { emptyForm, templateToJobForm, buildJobPayload } from '../utils/jobTemplates';
import '../styles/TechnicianJobs.css';
import '../styles/JobTemplates.css';

const messageFor = error => error.response?.data?.message || 'Something went wrong. Please try again.';
const date = value => value ? new Date(value).toLocaleString('en-IN') : 'Not set';
const textOnly = html => new DOMParser().parseFromString(html || '', 'text/html').body.textContent || 'Not provided';
const payFields = { fixed: ['fixedAmount', 'approxHours'], hourly: ['hourlyRate', 'maxHours', 'approxHours'], perDevice: ['perDeviceRate', 'maxDevices'], blended: ['blendedFixedAmount', 'blendedFixedHours', 'blendedHourlyRate', 'blendedMaxAddlHours', 'approxHours'] };
const payLabels = { fixedAmount: 'Fixed amount ($)', approxHours: 'Approximate hours', hourlyRate: 'Hourly rate ($)', maxHours: 'Maximum hours', perDeviceRate: 'Rate per device ($)', maxDevices: 'Maximum devices', blendedFixedAmount: 'Fixed payment ($)', blendedFixedHours: 'Fixed hours', blendedHourlyRate: 'Additional hourly rate ($)', blendedMaxAddlHours: 'Maximum additional hours' };
function Details({ template: t }) {
  const rows = [
    ['Job title', t.title], ['Location', t.location], ['City', t.city], ['State', t.state], ['Zip code', t.zipCode],
    ['Coordinates', t.coordinates?.lat != null && t.coordinates?.lng != null ? `${t.coordinates.lat}, ${t.coordinates.lng}` : 'Not set'],
    ['Work type', [t.workType?.name, t.workType?.subType?.name].filter(Boolean).join(' / ')],
    ['Additional work type', [t.additionalWorkType?.name, t.additionalWorkType?.subType?.name].filter(Boolean).join(' / ')],
    ['Service type', t.serviceType?.name], ['Window start', date(t.jobDate?.from)], ['Window end', date(t.jobDate?.to)],
    ['Pay type', { fixed: 'Fixed', hourly: 'Hourly', perDevice: 'Per Device', blended: 'Blended' }[t.pay?.type]],
    ...(payFields[t.pay?.type] || []).map(key => [payLabels[key], t.pay?.[key] ?? 'Not set']),
    ['Preferred skills', (t.preferredSkills || []).join(', ')], ['Requirements', (t.requirements || []).join(', ')],
    ['Created', date(t.createdAt)], ['Last updated', date(t.updatedAt)],
  ];
  return <><dl className="jtpl-details">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value === '' || value == null ? 'Not provided' : value}</dd></div>)}</dl>
    <h6>Description</h6><p className="jtpl-description">{textOnly(t.description)}</p>
    <h6>Tasks ({t.tasks?.length || 0})</h6>{!t.tasks?.length ? <p className="text-muted">No tasks in this template.</p> : <ol className="jtpl-tasks">{t.tasks.map((task, index) => <li key={task._id || index}><strong>{task.title}</strong> <span className="text-muted">{task.group && `· ${task.group}`}</span>{(task.requiresNote || task.requiresImage || task.requiresSignature) && <div>Required evidence: {[task.requiresNote && 'Note', task.requiresImage && 'Image', task.requiresSignature && 'Signature'].filter(Boolean).join(', ')}<p className="text-muted mb-0">{task.requirementReason}</p></div>}</li>)}</ol>}
  </>;
}

export default function JobTemplates() {
  const { can } = useAdminAuth();
  const canWrite = can('technician_jobs', 'write');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [modalError, setModalError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [workTypes, setWorkTypes] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await adminApi.getTechnicianJobTemplates(); setTemplates(response.data?.templates || []); }
    catch (err) { setError(messageFor(err)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const open = async (type, template) => {
    setModal({ type, template: null, id: template?._id }); setModalError(''); setBusy(true);
    try {
      const [detail, work, service] = await Promise.all([
        template ? adminApi.getTechnicianJobTemplate(template._id) : Promise.resolve(null),
        type !== 'view' ? adminApi.getWorkTypes() : Promise.resolve(null),
        type !== 'view' ? adminApi.getServiceTypes() : Promise.resolve(null),
      ]);
      const current = detail?.data?.template;
      if (type !== 'view') {
        setWorkTypes(work.data?.workTypes || []); setServiceTypes(service.data?.serviceTypes || []);
        setForm(current ? { ...templateToJobForm(current, emptyForm), templateName: current.templateName } : { ...emptyForm, templateName: '' });
      }
      setModal({ type, template: current, id: current?._id, ready: true });
    } catch (err) { setModalError(messageFor(err)); }
    finally { setBusy(false); }
  };
  const close = () => { if (!busy) { setModal(null); setModalError(''); } };
  const save = async event => {
    event.preventDefault(); setBusy(true); setModalError('');
    try {
      const payload = { ...buildJobPayload(form, workTypes, serviceTypes), templateName: form.templateName };
      if (modal.type === 'edit') await adminApi.updateTechnicianJobTemplate(modal.id, payload);
      else await adminApi.createTechnicianJobTemplate(payload);
      toast.success(modal.type === 'edit' ? 'Template updated.' : 'Template created.'); setModal(null); await load();
    } catch (err) { setModalError(messageFor(err)); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setModalError('');
    try { await adminApi.deleteTechnicianJobTemplate(modal.template._id); toast.success('Template deleted.'); setModal(null); await load(); }
    catch (err) { setModalError(messageFor(err)); }
    finally { setBusy(false); }
  };
  const filtered = templates.filter(t => [t.templateName, t.title, t.location, t.workType?.name].join(' ').toLowerCase().includes(search.toLowerCase()));
  return <div className="tj-page jtpl-page">
    <div className="tj-page-header"><div><div className="tj-breadcrumb">Field Operations › Templates</div><h1 className="tj-page-title">Job Templates</h1><p className="tj-page-sub">View and manage reusable technician job templates.</p></div>{canWrite && <button className="tj-btn-primary-gold" onClick={() => open('create')}><FaPlus className="me-2" />Create Template</button>}</div>
    <label className="jtpl-search"><FaSearch /><input aria-label="Search templates" placeholder="Search by template, job or location" value={search} onChange={e => setSearch(e.target.value)} /></label>
    {loading ? <p role="status" className="p-4">Loading templates…</p> : error ? <div role="alert" className="alert alert-danger">{error} <button className="btn btn-link" onClick={load}>Retry</button></div> : <div className="jtpl-table-wrap"><table className="table align-middle mb-0"><thead><tr>{['Template Name', 'Job Title', 'Location', 'Tasks', 'Last Updated', 'Actions'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{filtered.length ? filtered.map(template => <tr key={template._id}><td><strong>{template.templateName}</strong></td><td>{template.title}</td><td>{template.location}</td><td>{template.tasks?.length || 0}</td><td>{date(template.updatedAt)}</td><td><div className="jtpl-actions"><button aria-label={`View ${template.templateName}`} onClick={() => open('view', template)}><FaEye /> View</button>{canWrite && <><button aria-label={`Edit ${template.templateName}`} onClick={() => open('edit', template)}><FaEdit /> Edit</button><button className="text-danger" aria-label={`Delete ${template.templateName}`} onClick={() => { setModalError(''); setModal({ type: 'delete', template }); }}><FaTrash /> Delete</button></>}</div></td></tr>) : <tr><td colSpan={6} className="text-center text-muted p-5">{search ? 'No templates match your search.' : 'No templates yet. Create your first job template to get started.'}</td></tr>}</tbody></table></div>}
    {!loading && !error && <p className="text-muted small">Showing {filtered.length} of {templates.length} templates</p>}
    <Modal show={!!modal} onHide={close} size={modal?.type === 'delete' ? undefined : 'lg'} centered backdrop={busy ? 'static' : true} keyboard={!busy} aria-labelledby="template-modal-title">
      <Modal.Header closeButton={!busy}><Modal.Title id="template-modal-title">{modal?.type === 'view' ? modal.template?.templateName || 'View Template' : modal?.type === 'edit' ? 'Update Template' : modal?.type === 'delete' ? 'Delete Template' : 'Create Template'}</Modal.Title></Modal.Header>
      <Modal.Body>{modalError && <div role="alert" className="alert alert-danger">{modalError}</div>}
        {modal?.type === 'delete' ? <p>Delete <strong>{modal.template.templateName}</strong>? Existing jobs created from this template will remain unchanged.</p> : !modal?.ready ? <p>{busy ? 'Loading template…' : 'Close this window and try again.'}</p> : modal.type === 'view' ? <Details template={modal.template} /> : <JobForm form={form} setForm={setForm} onSubmit={save} onCancel={close} isTemplate isEditing={modal.type === 'edit'} saving={busy} workTypes={workTypes} serviceTypes={serviceTypes} />}
      </Modal.Body>
      {modal?.type === 'delete' && <Modal.Footer><button className="btn tj-btn-ghost" disabled={busy} onClick={close}>Cancel</button><button className="btn btn-danger" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete Template'}</button></Modal.Footer>}
      {modal?.type === 'view' && <Modal.Footer><button className="btn tj-btn-ghost" onClick={close}>Close</button>{canWrite && modal.ready && <button className="btn tj-btn-primary-gold" onClick={() => open('edit', modal.template)}>Edit Template</button>}</Modal.Footer>}
    </Modal>
  </div>;
}
