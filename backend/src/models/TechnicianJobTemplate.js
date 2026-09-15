const mongoose = require('mongoose');
const TechnicianJob = require('./TechnicianJob');

// Reuse the job schema's field types and validators, without live-job state.
const TEMPLATE_FIELDS = [
  'title', 'location', 'city', 'state', 'zipCode', 'coordinates', 'pay',
  'description', 'requirements', 'preferredSkills', 'workType',
  'additionalWorkType', 'serviceType', 'jobDate', 'scheduledDate', 'visibleTo',
];
const TASK_FIELDS = ['title', 'group', 'order', 'requiresNote', 'requiresImage', 'requiresSignature', 'requirementReason'];
const schema = TechnicianJob.schema.pick([...TEMPLATE_FIELDS, 'postedBy']);
schema.add({
  templateName: { type: String, required: true, trim: true, maxlength: 120 },
  tasks: [TechnicianJob.schema.path('tasks').schema.pick(TASK_FIELDS)],
});
schema.index({ createdAt: -1 });
module.exports = mongoose.model('TechnicianJobTemplate', schema);
module.exports.TEMPLATE_FIELDS = TEMPLATE_FIELDS;
module.exports.TASK_FIELDS = TASK_FIELDS;
