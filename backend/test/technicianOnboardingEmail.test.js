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
test('onboarding email shows credentials in an HTML table with a plain text fallback', async () => {
  const previous = process.env.SMTP_PASS;
  process.env.SMTP_PASS = 'test';
  try {
    await sendTechnicianOnboardingEmail('tech@example.com', 'generated-test-password');
    assert.equal(message.to, 'tech@example.com');
    assert.equal(message.from.name, 'Technician Onboarding');
    assert.match(message.text, /Password: generated-test-password/);
    assert.match(message.text, /OTP to activate your account/);
    assert.match(message.text, /Email: tech@example.com/);
    assert.match(message.html, /<table/);
    assert.match(message.html, />Email<\/th>/);
    assert.match(message.html, />Password<\/th>/);
    assert.match(message.html, /tech@example.com/);
    assert.match(message.html, /generated-test-password/);
    assert.doesNotMatch(message.subject + message.text, /1\s?app|https?:|header|footer/i);
  } finally {
    if (previous === undefined) delete process.env.SMTP_PASS;
    else process.env.SMTP_PASS = previous;
  }
});
