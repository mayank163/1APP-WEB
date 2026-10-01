const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const controllerSource = fs.readFileSync(path.join(__dirname, '../src/controllers/authController.js'), 'utf8');

function setup({ passwordMatches = true } = {}) {
    const calls = [];
    const account = {
        password: 'existing-hash',
        async comparePassword(candidate) {
            calls.push(['comparePassword', candidate]);
            return passwordMatches;
        },
        async save() {
            calls.push(['save', this.password]);
        },
    };
    const accountModel = {
        findById(id) {
            calls.push(['findById', id]);
            return {
                async select(fields) {
                    calls.push(['select', fields]);
                    return account;
                },
            };
        },
    };
    const module = { exports: {} };
    vm.runInNewContext(controllerSource, {
        module,
        exports: module.exports,
        require(name) {
            if (name === 'jsonwebtoken' || name === '../models/User' || name === '../utils/otpService') return {};
            if (name === '../utils/phone') return { normalizePhone() {}, phoneQuery() {} };
            if (name === '../utils/s3Upload') return { uploadFile() {}, deleteFile() {} };
            if (name === '../utils/emailService') return {
                sendWelcomeEmail() {},
                sendLoginNotification() {},
                sendForgotPasswordEmail() {},
                sendPasswordResetSuccess() {},
            };
            throw new Error(`Unexpected dependency: ${name}`);
        },
    }, { filename: 'authController.js' });

    return { changePassword: module.exports.changePassword, account, accountModel, calls };
}

function response() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
}

test('rejects an incorrect current password without saving', async () => {
    const { changePassword, accountModel, calls } = setup({ passwordMatches: false });
    const res = response();

    await changePassword({
        body: { oldPassword: 'wrong-password', newPassword: 'new-password' },
        user: { _id: 'account-1', constructor: accountModel },
    }, res, assert.fail);

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Current password is incorrect.');
    assert.deepEqual(calls, [
        ['findById', 'account-1'],
        ['select', '+password'],
        ['comparePassword', 'wrong-password'],
    ]);
});

test('updates the password when the current password matches', async () => {
    const { changePassword, account, accountModel, calls } = setup();
    const res = response();

    await changePassword({
        body: { oldPassword: 'current-password', newPassword: 'new-password' },
        user: { _id: 'account-1', constructor: accountModel },
    }, res, assert.fail);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(account.password, 'new-password');
    assert.deepEqual(calls, [
        ['findById', 'account-1'],
        ['select', '+password'],
        ['comparePassword', 'current-password'],
        ['save', 'new-password'],
    ]);
});