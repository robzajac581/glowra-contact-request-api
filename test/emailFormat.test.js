// formatEmailBody: the clinic-facing email text. Pure function; nothing is sent.
// Runs in its own process (node --test), so the real emailService module loads
// here. Requiring it only configures the SendGrid client; no network.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

process.env.SENDGRID_API_KEY = 'SG.test-not-real';
const { formatEmailBody } = require('../utils/emailService');

function request(overrides = {}) {
  return {
    requestId: '11111111-1111-4111-8111-111111111111',
    firstName: 'Ana',
    lastName: 'Lee',
    email: 'ana@example.com',
    phone: null,
    message: null,
    clinicId: '123',
    clinicName: 'Test Clinic',
    patientStatus: 'new',
    selectedProcedures: [],
    createdAt: new Date('2026-11-25T12:00:00Z'),
    ...overrides,
  };
}

describe('formatEmailBody', () => {
  test('lists priced procedures and the total', () => {
    const body = formatEmailBody(request({
      selectedProcedures: [
        { name: 'Botox', price: 300 },
        { name: 'Filler', price: 650.5 },
      ],
    }));

    assert.match(body, /1\. Botox - \$300\.00/);
    assert.match(body, /2\. Filler - \$650\.50/);
    assert.match(body, /Total Estimate: \$950\.50\n/);
    assert.doesNotMatch(body, /no listed price/);
  });

  test('shows "price not listed" for null prices and leaves them out of the total (GLO-118)', () => {
    const body = formatEmailBody(request({
      selectedProcedures: [
        { name: 'Botox', price: 300 },
        { name: 'Consultation', price: null },
      ],
    }));

    assert.match(body, /2\. Consultation - price not listed/);
    assert.match(body, /Total Estimate: \$300\.00 \(excludes 1 procedure with no listed price\)/);
    assert.doesNotMatch(body, /Consultation - \$0\.00/);
  });

  test('handles numeric-string prices from older stored requests', () => {
    const body = formatEmailBody(request({
      selectedProcedures: [{ name: 'Botox', price: '300' }],
    }));

    assert.match(body, /1\. Botox - \$300\.00/);
  });

  test('shows the fallback clinic name', () => {
    const body = formatEmailBody(request({ clinicName: 'Unknown clinic (ID 123)' }));

    assert.match(body, /Clinic Name: Unknown clinic \(ID 123\)/);
  });
});
