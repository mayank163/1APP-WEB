const emptyJobDate = { from: '', to: '' };
const emptyPay = {
  type: 'fixed',
  fixedAmount: '', hourlyRate: '', maxHours: '',
  perDeviceRate: '', maxDevices: '',
  blendedFixedAmount: '', blendedFixedHours: '',
  blendedHourlyRate: '', blendedMaxAddlHours: '',
  approxHours: '',
};
export const emptyForm = {
  title: '', location: '', city: '', state: '', zipCode: '',
  coordinates: null, pay: { ...emptyPay }, jobDate: { ...emptyJobDate },
  description: '', preferredSkills: '', requirements: '', tasks: [],
  workTypeId: '', workTypeSubId: '', additionalWorkTypeId: '',
  additionalWorkTypeSubId: '', serviceTypeId: '', scheduledDate: '', visibleTo: 'technicians',
};


const localDateTime = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

// Copy only editable defaults. Each application gets fresh task objects.
export const templateToJobForm = (template, defaults) => ({
  ...defaults,
  title: template.title || '', location: template.location || '',
  city: template.city || '', state: template.state || '', zipCode: template.zipCode || '',
  coordinates: template.coordinates?.lat != null && template.coordinates?.lng != null ? { ...template.coordinates } : null,
  pay: { ...defaults.pay, ...template.pay },
  description: template.description || '',
  requirements: (template.requirements || []).join(', '),
  preferredSkills: (template.preferredSkills || []).join(', '),
  workTypeId: template.workType?._id || '', workTypeSubId: template.workType?.subType?._id || '',
  additionalWorkTypeId: template.additionalWorkType?._id || '', additionalWorkTypeSubId: template.additionalWorkType?.subType?._id || '',
  serviceTypeId: template.serviceType?._id || '',
  scheduledDate: localDateTime(template.scheduledDate), visibleTo: template.visibleTo || 'technicians',
  jobDate: { from: localDateTime(template.jobDate?.from), to: localDateTime(template.jobDate?.to) },
  tasks: (template.tasks || []).map((task, order) => ({
    title: task.title, group: task.group || 'Prep', order, isDone: false,
    requiresNote: Boolean(task.requiresNote), requiresImage: Boolean(task.requiresImage),
    requiresSignature: Boolean(task.requiresSignature), requirementReason: task.requirementReason || '',
  })),
});

export const buildJobPayload = (f, workTypes, serviceTypes) => {
    const wt = workTypes.find(w => w._id === f.workTypeId);
    const wtSub = wt?.subTypes?.find(s => s._id === f.workTypeSubId);
    const awt = workTypes.find(w => w._id === f.additionalWorkTypeId);
    const awtSub = awt?.subTypes?.find(s => s._id === f.additionalWorkTypeSubId);
    const st = serviceTypes.find(s => s._id === f.serviceTypeId);
    const p = f.pay || {};
    const pay = { type: p.type || 'fixed', fixedAmount: Number(p.fixedAmount || 0), hourlyRate: Number(p.hourlyRate || 0), maxHours: Number(p.maxHours || 0), perDeviceRate: Number(p.perDeviceRate || 0), maxDevices: Number(p.maxDevices || 0), blendedFixedAmount: Number(p.blendedFixedAmount || 0), blendedFixedHours: Number(p.blendedFixedHours || 0), blendedHourlyRate: Number(p.blendedHourlyRate || 0), blendedMaxAddlHours: Number(p.blendedMaxAddlHours || 0), approxHours: p.approxHours || '' };
    return { ...f, pay, scheduledDate: f.scheduledDate ? new Date(f.scheduledDate).toISOString() : null, visibleTo: f.visibleTo || 'technicians', jobDate: { from: f.jobDate?.from ? new Date(f.jobDate.from).toISOString() : undefined, to: f.jobDate?.to ? new Date(f.jobDate.to).toISOString() : undefined }, preferredSkills: f.preferredSkills.split(',').map(s => s.trim()).filter(Boolean), requirements: f.requirements.split(',').map(s => s.trim()).filter(Boolean), coordinates: f.coordinates || undefined, city: f.city || '', state: f.state || '', zipCode: f.zipCode || '', tasks: (f.tasks || []).map((t, i) => ({ ...t, order: i })), workType: wt ? { _id: wt._id, name: wt.name, subType: wtSub ? { _id: wtSub._id, name: wtSub.name } : {} } : {}, additionalWorkType: awt ? { _id: awt._id, name: awt.name, subType: awtSub ? { _id: awtSub._id, name: awtSub.name } : {} } : {}, serviceType: st ? { _id: st._id, name: st.name } : {} };
  };

