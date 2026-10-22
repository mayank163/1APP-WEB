const areas = require('./technicianAreas.json');
exports.parseTechnicianDetails = (body, required = false) => {
  const result = {};
  const fail = message => { throw Object.assign(new Error(message), { statusCode: 400 }); };
  if (required || body.technicianType !== undefined) {
    if (!['freelancer', 'business'].includes(body.technicianType)) fail('Select Freelancer or Business.');
    result.technicianType = body.technicianType;
  }
  if (required || body.workAreas !== undefined) {
    let values = body.workAreas;
    if (typeof values === 'string') {
      try { values = JSON.parse(values); } catch { fail('Select valid work areas.'); }
    }
    if (!Array.isArray(values) || !values.length || values.some(value => !areas.includes(value))) fail('Select at least one valid work area.');
    result.workAreas = [...new Set(values)];
  }
  return result;
};
