// Kost/database/pool.js - MariaDB connection pool with JSON fallback
const mysql = require('mysql2/promise');

let pool = null;
let useDatabase = true;

function getPool() {
    if (!pool && useDatabase) {
        try {
            pool = mysql.createPool({
                host: process.env.DB_HOST || 'localhost',
                port: Number(process.env.DB_PORT) || 3306,
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'bot_wa',
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                dateStrings: true
            });
        } catch (err) {
            console.warn('[Kost/Database] Warning creating pool, falling back to JSON cache:', err.message);
            pool = null;
            useDatabase = false;
        }
    }
    return pool;
}

module.exports = {
    getPool
};
