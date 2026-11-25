// App-level checks: loading app.js must not start anything, health works,
// unknown routes 404, and the clinic listing route validates input.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp, startServer, postJson } = require('./helpers/loadApp');

describe('app', () => {
  let ctx;
  let server;

  before(async () => {
    ctx = loadApp();
    server = await startServer(ctx.app);
  });

  after(async () => {
    await server.close();
  });

  test('GET /health returns ok', async () => {
    const res = await fetch(`${server.url}/health`);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.status, 'ok');
  });

  test('unknown routes return 404 JSON', async () => {
    const res = await fetch(`${server.url}/nope`);
    const body = await res.json();

    assert.equal(res.status, 404);
    assert.equal(body.success, false);
  });

  test('POST /api/clinic-listing-requests rejects a missing city with 400', async () => {
    let called = false;
    ctx.listingService.createListingRequest = async () => { called = true; return {}; };

    const res = await postJson(`${server.url}/api/clinic-listing-requests`, {
      clinicName: 'Test Clinic',
      state: 'FL',
      address: '1 Main St',
      email: 'owner@example.com',
      requestType: 'new',
    });

    assert.equal(res.status, 400);
    assert.ok(res.body.details.city);
    assert.equal(called, false);
  });
});
