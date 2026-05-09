// const mysql = require('mysql');
// require('dotenv').config();

// class Database {
//     constructor() {
//         this.pool = mysql.createPool({
//             host: process.env.DB_HOST || process.env.DBHost,
//             user: process.env.DB_USER || process.env.DBUser,
//             password: process.env.DB_PASSWORD || process.env.DBpassword,
//             database: process.env.DB_NAME || process.env.DBName,
//             port: process.env.DB_PORT || process.env.DBPort || 3308,
//             connectionLimit: 10,
//             waitForConnections: true,
//             queueLimit: 0,
//             connectTimeout: 10000,
//             acquireTimeout: 10000,
//             timeout: 60000,
//             charset: 'utf8mb4',
//             supportBigNumbers: true,
//             bigNumberStrings: true,
//             multipleStatements: false, // Security: prevent SQL injection
//             dateStrings: true
//         });

//         this.testConnection();
//     }

//     testConnection() {
//         this.pool.getConnection((err, connection) => {
//             if (err) {
//                 console.error('❌ Database connection failed:', {
//                     code: err.code,
//                     message: err.message,
//                     fatal: err.fatal
//                 });
//                 return;
//             }

//             console.log('✅ Database connected successfully');
//             console.log(`📊 Connected to: ${process.env.DB_NAME || process.env.DBName}`);
//             console.log(`📍 Host: ${process.env.DB_HOST || process.env.DBHost}:${process.env.DB_PORT || process.env.DBPort || 3308}`);

//             // Test with a simple query
//             connection.query('SELECT 1 + 1 AS result', (queryErr) => {
//                 if (queryErr) {
//                     console.error('❌ Database query test failed:', queryErr.message);
//                 } else {
//                     console.log('✅ Database query test successful');
//                 }
//                 connection.release();
//             });
//         });
//     }

//     // Promise-based query method
//     query(sql, params = []) {
//         return new Promise((resolve, reject) => {
//             this.pool.query(sql, params, (error, results) => {
//                 if (error) {
//                     console.error('Database Query Error:', {
//                         sql: sql.substring(0, 200), // Log first 200 chars of query
//                         params: params,
//                         error: error.message
//                     });
//                     reject(error);
//                 } else {
//                     resolve(results);
//                 }
//             });
//         });
//     }

//     // Get a connection from the pool (for transactions)
//     getConnection() {
//         return new Promise((resolve, reject) => {
//             this.pool.getConnection((err, connection) => {
//                 if (err) {
//                     reject(err);
//                 } else {
//                     resolve(connection);
//                 }
//             });
//         });
//     }

//     // Handle graceful shutdown
//     close() {
//         return new Promise((resolve) => {
//             this.pool.end((err) => {
//                 if (err) {
//                     console.error('Error closing database pool:', err.message);
//                 } else {
//                     console.log('Database pool closed successfully');
//                 }
//                 resolve();
//             });
//         });
//     }
// }

// // Create a singleton instance
// const database = new Database();

// module.exports = database;


const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    connectTimeout: 10000,
    acquireTimeout: 10000,
    timeout: 60000,
});

// Test connection on startup
pool.getConnection()
    .then(connection => {
        console.log('✅ Face Recognition MySQL Connected!');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Face Recognition MySQL Connection Failed:', err.message);
    });

module.exports = pool;