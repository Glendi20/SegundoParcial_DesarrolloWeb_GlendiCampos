const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 1433),
  options: {
    encrypt: process.env.DB_ENCRYPT !== 'false',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  connectionTimeout: 60000, // Azure SQL serverless puede tardar en "despertar"
  requestTimeout: 30000,
};

let poolPromise = null;

/** Pool de conexiones reutilizable (se crea una sola vez). */
function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .catch((err) => {
        poolPromise = null; // permite reintentar en la siguiente petición
        throw err;
      });
  }
  return poolPromise;
}

module.exports = { sql, getPool };
