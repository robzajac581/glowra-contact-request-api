const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

let pool = null;

async function getPool() {
  if (!pool) {
    try {
      pool = await sql.connect(config);
      console.log('Database connection pool established');
      return pool;
    } catch (err) {
      console.error('Database connection error:', err);
      throw err;
    }
  }
  return pool;
}

async function closePool() {
  if (pool) {
    try {
      await pool.close();
      console.log('Database connection pool closed');
      pool = null;
    } catch (err) {
      console.error('Error closing database pool:', err);
    }
  }
}

// Initialize pool on module load
getPool().catch(err => {
  console.error('Failed to initialize database pool:', err);
});

module.exports = {
  getPool,
  closePool,
  sql
};

