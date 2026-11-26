// Loads the Express app with the database, SendGrid and services replaced by
// fakes, so tests never touch Azure SQL or send email.
//
// db.js connects on module load and emailService calls SendGrid, and both read
// the local .env, so they must never be required for real in tests. We put
// fake modules into require.cache under their real paths before app.js loads.

const path = require('path');

const root = path.join(__dirname, '..', '..');

function installFake(relPath, exports) {
  const filename = require.resolve(path.join(root, relPath));
  require.cache[filename] = {
    id: filename,
    filename,
    loaded: true,
    exports,
  };
  return exports;
}

function loadApp() {
  // Fresh copies each time so state never leaks between test files.
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(root) && !key.includes(`${path.sep}node_modules${path.sep}`) && !key.includes(`${path.sep}test${path.sep}`)) {
      delete require.cache[key];
    }
  }

  installFake('db.js', {
    getPool: async () => {
      throw new Error('Test tried to use the real database');
    },
    closePool: async () => {},
    sql: {},
  });

  installFake('utils/emailService.js', {
    sendConsultationRequestEmail: async () => {
      throw new Error('Test tried to send a real email');
    },
    sendClinicListingRequestEmail: async () => {
      throw new Error('Test tried to send a real email');
    },
  });

  const consultationService = installFake('services/consultationRequestService.js', {
    createRequest: async () => ({ requestId: '11111111-1111-4111-8111-111111111111' }),
    getRequestById: async () => null,
    reprocessRequest: async () => {},
    sendEmail: async () => {},
    getPendingRetries: async () => [],
  });

  const listingService = installFake('services/clinicListingService.js', {
    createListingRequest: async () => ({
      requestId: '22222222-2222-4222-8222-222222222222',
      status: 'pending',
    }),
  });

  const app = require(path.join(root, 'app.js'));
  return { app, consultationService, listingService };
}

// Starts the app on a random port; returns { url, close }.
async function startServer(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

module.exports = { loadApp, startServer, postJson };
