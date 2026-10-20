const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
let message;
Module._load = function (name, ...args) {
  if (name === 'nodemailer') return { createTransport: () => ({ sendMail: async options => { message = options; return { messageId: 'test' }; } }) };
  return originalLoad.call(this, name, ...args);
};
const { sendTechnicianOnboardingEmail } = require('../src/utils/emailService');
Module._load = originalLoad;
test('onboarding email is plain text with no branding, layout, or links', async () => {
  const previous = process.env.SMTP_PASS;
  process.env.SMTP_PASS = 'test';
  try {
    await sendTechnicianOnboardingEmail('tech@example.com');
    assert.equal(message.to, 'tech@example.com');
    assert.equal(message.from.name, 'Technician Onboarding');
    assert.equal(message.text, 'Thank you! You have been successfully onboarded.');
    assert.equal(message.html, '');
    assert.doesNotMatch(message.subject + message.text, /1\s?app|https?:|header|footer|sign.in/i);
  } finally {
    if (previous === undefined) delete process.env.SMTP_PASS;
    else process.env.SMTP_PASS = previous;
  }
});
