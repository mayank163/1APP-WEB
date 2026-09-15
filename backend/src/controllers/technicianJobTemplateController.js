const Template = require('../models/TechnicianJobTemplate');
const { TEMPLATE_FIELDS, TASK_FIELDS } = Template;
const pick = (source, fields) => Object.fromEntries(fields.filter(key => source?.[key] !== undefined).map(key => [key, source[key]]));

const buildTemplate = (body, adminId) => {
  const data = pick(body, TEMPLATE_FIELDS);
  data.templateName = body.templateName;
  data.postedBy = adminId;
  data.tasks = Array.isArray(body.tasks) ? body.tasks.map((task, order) => ({ ...pick(task, TASK_FIELDS), order })) : [];
  return data;
};

const validateTemplate = data => {
    const invalidTask = data.tasks.find(task => (task.requiresNote || task.requiresImage || task.requiresSignature) && !String(task.requirementReason || '').trim());
    if (invalidTask) throw Object.assign(new Error('Provide a reason for required task completion evidence.'), { statusCode: 400 });
    if (data.jobDate?.from && data.jobDate?.to && new Date(data.jobDate.from) >= new Date(data.jobDate.to)) {
      throw Object.assign(new Error('The job window end must be after its start.'), { statusCode: 400 });
    }
};

exports.getTemplates = async (req, res, next) => {
  try {
    const templates = await Template.find().sort('-createdAt');
    res.json({ success: true, data: { templates } });
  } catch (error) { next(error); }
};
exports.createTemplate = async (req, res, next) => {
  try {
    const data = buildTemplate(req.body, req.user._id);
    validateTemplate(data);
    const template = await Template.create(data);
    res.status(201).json({ success: true, message: 'Job template saved.', data: { template } });
  } catch (error) {
    templateError(error, res, next);
  }
};
exports.buildTemplate = buildTemplate;

const templateError = (error, res, next) => {
  if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message });
  if (error.name === 'CastError') return res.status(400).json({ success: false, message: 'Invalid template ID or field value.' });
  if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: Object.values(error.errors).map(item => item.message).join(' ') });
  next(error);
};
exports.getTemplate = async (req, res, next) => {
  try {
    const template = await Template.findById(req.params.templateId);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found.' });
    res.json({ success: true, data: { template } });
  } catch (error) { templateError(error, res, next); }
};
exports.updateTemplate = async (req, res, next) => {
  try {
    const template = await Template.findById(req.params.templateId);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found.' });
    const data = buildTemplate(req.body, template.postedBy);
    validateTemplate(data);
    template.set(data);
    await template.save();
    res.json({ success: true, message: 'Template updated.', data: { template } });
  } catch (error) { templateError(error, res, next); }
};
exports.deleteTemplate = async (req, res, next) => {
  try {
    const template = await Template.findByIdAndDelete(req.params.templateId);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found.' });
    res.json({ success: true, message: 'Template deleted.' });
  } catch (error) { templateError(error, res, next); }
};
