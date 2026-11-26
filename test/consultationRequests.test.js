// Route tests for /api/consultation-requests: the booking path.
// DB, SendGrid and the service layer are faked (see helpers/loadApp.js).

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, startServer, postJson } = require('./helpers/loadApp');

// Same shape glowra-FE sends (src/components/ConsultationRequestForm.jsx).
function fePayload(overrides = {}) {
  return {
    firstName: 'Ana',
    lastName: 'Lee',
    email: 'Ana.Lee@Example.com',
    phone: null,
    message: null,
    patientStatus: 'new',
    clinicId: 123,
    clinicName: 'Test Clinic',
    selectedProcedures: [{ id: 7, name: 'Botox', price: 300 }],
    ...overrides,
  };
}

describe('POST /api/consultation-requests', () => {
  let ctx;
  let server;
  let url;
  let received;

  before(async () => {
    ctx = loadApp();
    server = await startServer(ctx.app);
    url = `${server.url}/api/consultation-requests`;
  });

  after(async () => {
    await server.close();
  });

  beforeEach(() => {
    received = undefined;
    ctx.consultationService.createRequest = async (body) => {
      received = body;
      return { requestId: '11111111-1111-4111-8111-111111111111' };
    };
  });

  test('accepts the payload the FE sends and returns the request id', async () => {
    const res = await postJson(url, fePayload());

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.requestId, '11111111-1111-4111-8111-111111111111');
    assert.ok(received, 'service should be called');
    assert.equal(received.firstName, 'Ana');
    assert.equal(received.clinicName, 'Test Clinic');
  });

  test('passes numeric FE ids to the service as strings', async () => {
    await postJson(url, fePayload());

    assert.equal(received.clinicId, '123');
    assert.equal(received.selectedProcedures[0].id, '7');
    assert.equal(received.selectedProcedures[0].price, 300);
  });

  test('normalizes the email address', async () => {
    await postJson(url, fePayload());

    assert.equal(received.email, 'ana.lee@example.com');
  });

  test('accepts a request with no procedures selected', async () => {
    const res = await postJson(url, fePayload({ selectedProcedures: [] }));

    assert.equal(res.status, 200);
  });

  for (const field of ['firstName', 'lastName', 'email', 'clinicId']) {
    test(`rejects a missing ${field} with 400 and does not call the service`, async () => {
      const res = await postJson(url, fePayload({ [field]: '' }));

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.equal(res.body.error, 'Validation failed');
      assert.ok(res.body.details[field], `details should name ${field}`);
      assert.equal(received, undefined);
    });
  }

  test('rejects an invalid email with 400', async () => {
    const res = await postJson(url, fePayload({ email: 'not-an-email' }));

    assert.equal(res.status, 400);
    assert.equal(res.body.details.email, 'Invalid email format');
  });

  test('rejects an unknown patientStatus with 400', async () => {
    const res = await postJson(url, fePayload({ patientStatus: 'vip' }));

    assert.equal(res.status, 400);
    assert.ok(res.body.details.patientStatus);
  });

  test('rejects a message over 5000 characters with 400', async () => {
    const res = await postJson(url, fePayload({ message: 'x'.repeat(5001) }));

    assert.equal(res.status, 400);
    assert.ok(res.body.details.message);
  });

  test('returns 500 without internal details when the service fails', async () => {
    ctx.consultationService.createRequest = async () => {
      throw new Error('db exploded: secret connection string');
    };

    const res = await postJson(url, fePayload());

    assert.equal(res.status, 500);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error, 'Internal server error');
    assert.doesNotMatch(JSON.stringify(res.body), /secret/);
  });

  // GLO-118: payloads the FE can send must not lose the booking.
  test('accepts a selected procedure with no listed price (null)', async () => {
    const res = await postJson(url, fePayload({
      selectedProcedures: [
        { id: 7, name: 'Botox', price: 300 },
        { id: 8, name: 'Consultation', price: null },
      ],
    }));

    assert.equal(res.status, 200);
    assert.equal(received.selectedProcedures[0].price, 300);
    assert.equal(received.selectedProcedures[1].price, null);
  });

  test('converts a numeric-string price to a number', async () => {
    await postJson(url, fePayload({
      selectedProcedures: [{ id: 7, name: 'Botox', price: '300.50' }],
    }));

    assert.equal(received.selectedProcedures[0].price, 300.5);
  });

  test('still rejects a non-numeric price with 400', async () => {
    const res = await postJson(url, fePayload({
      selectedProcedures: [{ id: 7, name: 'Botox', price: 'call us' }],
    }));

    assert.equal(res.status, 400);
    assert.ok(res.body.details['selectedProcedures[0].price']);
    assert.equal(received, undefined);
  });

  for (const clinicName of [null, '', '   ']) {
    test(`accepts clinicName ${JSON.stringify(clinicName)} and falls back to the clinic id`, async () => {
      const res = await postJson(url, fePayload({ clinicName }));

      assert.equal(res.status, 200);
      assert.equal(received.clinicName, 'Unknown clinic (ID 123)');
    });
  }

  test('rejects a request with neither clinicName nor clinicId', async () => {
    const res = await postJson(url, fePayload({ clinicName: null, clinicId: '' }));

    assert.equal(res.status, 400);
    assert.ok(res.body.details.clinicId);
    assert.equal(received, undefined);
  });
});

describe('POST /api/consultation-requests/:requestId/reprocess', () => {
  const id = '33333333-3333-4333-8333-333333333333';
  const KEY = 'test-admin-key';
  const auth = { 'X-API-Key': KEY };
  let ctx;
  let server;
  let savedKey;
  let reprocessed;
  let emailed;
  const reprocessUrl = (rid = id) => `${server.url}/api/consultation-requests/${rid}/reprocess`;

  before(async () => {
    savedKey = process.env.CONTACT_ADMIN_API_KEY;
    ctx = loadApp();
    server = await startServer(ctx.app);
  });

  after(async () => {
    await server.close();
    if (savedKey === undefined) delete process.env.CONTACT_ADMIN_API_KEY;
    else process.env.CONTACT_ADMIN_API_KEY = savedKey;
  });

  beforeEach(() => {
    process.env.CONTACT_ADMIN_API_KEY = KEY;
    reprocessed = undefined;
    emailed = undefined;
    ctx.consultationService.getRequestById = async () => ({ requestId: id, firstName: 'Ana' });
    ctx.consultationService.reprocessRequest = async (rid) => { reprocessed = rid; };
    ctx.consultationService.sendEmail = async (rid) => { emailed = rid; };
  });

  // GLO-119: the endpoint re-sends email, so it needs the admin key.
  test('rejects a request with no API key with 401 and sends nothing', async () => {
    const res = await postJson(reprocessUrl(), {});

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(reprocessed, undefined);
    assert.equal(emailed, undefined);
  });

  test('rejects a wrong API key with 401 and sends nothing', async () => {
    const res = await postJson(reprocessUrl(), {}, { 'X-API-Key': 'wrong-key' });

    assert.equal(res.status, 401);
    assert.equal(reprocessed, undefined);
    assert.equal(emailed, undefined);
  });

  test('refuses every request with 503 when CONTACT_ADMIN_API_KEY is unset', async () => {
    delete process.env.CONTACT_ADMIN_API_KEY;

    for (const headers of [{}, auth, { 'X-API-Key': '' }]) {
      const res = await postJson(reprocessUrl(), {}, headers);
      assert.equal(res.status, 503);
      assert.doesNotMatch(JSON.stringify(res.body), /CONTACT_ADMIN_API_KEY/);
    }
    assert.equal(reprocessed, undefined);
    assert.equal(emailed, undefined);
  });

  test('refuses with 503 when CONTACT_ADMIN_API_KEY is empty', async () => {
    process.env.CONTACT_ADMIN_API_KEY = '';

    const res = await postJson(reprocessUrl(), {}, { 'X-API-Key': '' });

    assert.equal(res.status, 503);
    assert.equal(emailed, undefined);
  });

  test('rejects a non-UUID id with 400', async () => {
    const res = await postJson(reprocessUrl('abc'), {}, auth);

    assert.equal(res.status, 400);
  });

  test('returns 404 for an unknown request', async () => {
    ctx.consultationService.getRequestById = async () => null;

    const res = await postJson(reprocessUrl(), {}, auth);

    assert.equal(res.status, 404);
  });

  test('queues a known request and re-sends its email', async () => {
    const res = await postJson(reprocessUrl(), {}, auth);

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'retrying');
    assert.equal(reprocessed, id);
    assert.equal(emailed, id);
  });

  test('does not require a key on the public booking form (POST /)', async () => {
    const res = await postJson(`${server.url}/api/consultation-requests`, fePayload());

    assert.equal(res.status, 200);
  });
});
