const mongoose = require('mongoose');

const TEMPLATE_FIELDS = [
  'title', 'location', 'city', 'state', 'zipCode', 'coordinates', 'pay',
  'description', 'requirements', 'preferredSkills', 'workType',
  'additionalWorkType', 'serviceType', 'jobDate', 'scheduledDate', 'visibleTo',
];
const TASK_FIELDS = ['title', 'group', 'order', 'requiresNote', 'requiresImage', 'requiresSignature', 'requirementReason'];

const taskSchema = new mongoose.Schema({
  title: { type: String, default: '', trim: true },
  group: { type: String, default: '', trim: true },
  order: { type: Number, default: 0 },
  requiresNote: { type: Boolean, default: false },
  requiresImage: { type: Boolean, default: false },
  requiresSignature: { type: Boolean, default: false },
  requirementReason: { type: String, default: '', trim: true },
}, { _id: true });

const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  location: { type: String, required: true, trim: true },
  city: { type: String, default: '', trim: true },
  state: { type: String, default: '', trim: true },
  zipCode: { type: String, default: '', trim: true },
  coordinates: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  pay: { type: mongoose.Schema.Types.Mixed, default: null },
  description: { type: String, default: '', trim: true },
  requirements: [{ type: String, trim: true }],
  preferredSkills: [{ type: String, trim: true }],
  workType: { type: mongoose.Schema.Types.Mixed, default: null },
  additionalWorkType: { type: mongoose.Schema.Types.Mixed, default: null },
  serviceType: { type: mongoose.Schema.Types.Mixed, default: null },
  jobDate: {
    from: { type: Date, default: null },
    to: { type: Date, default: null },
  },
  scheduledDate: { type: Date, default: null },
  visibleTo: { type: String, enum: ['all', 'technicians'], default: 'technicians' },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  templateName: { type: String, required: true, trim: true, maxlength: 120 },
  tasks: [taskSchema],
}, { timestamps: true });
schema.index({ createdAt: -1 });
module.exports = mongoose.model('TechnicianJobTemplate', schema);
module.exports.TEMPLATE_FIELDS = TEMPLATE_FIELDS;
module.exports.TASK_FIELDS = TASK_FIELDS;
