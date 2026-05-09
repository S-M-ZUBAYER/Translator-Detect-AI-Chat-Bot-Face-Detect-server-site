const mysql = require('mysql');
require('dotenv').config();

// Check if environment variables are loaded
if (!process.env.DB_HOST && !process.env.DBHost) {
  console.error('❌ Database environment variables are not loaded!');
  console.log('Make sure .env file exists with:');
  console.log('DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT');
}

// Create a simple connection pool without complex class structure
const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.DBHost,
  user: process.env.DB_USER || process.env.DBUser,
  password: process.env.DB_PASSWORD || process.env.DBpassword,
  database: process.env.DB_NAME || process.env.DBName,
  port: parseInt(process.env.DB_PORT || process.env.DBPort || 3308),
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  connectTimeout: 10000,
  acquireTimeout: 10000,
  timeout: 60000,
  ssl: false,
  charset: 'utf8mb4',
  supportBigNumbers: true,
  bigNumberStrings: true,
  multipleStatements: false,
  dateStrings: true
});

// Test the connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    console.log('Connection details:', {
      host: process.env.DB_HOST || process.env.DBHost,
      port: process.env.DB_PORT || process.env.DBPort || 3308,
      user: process.env.DB_USER || process.env.DBUser,
      database: process.env.DB_NAME || process.env.DBName
    });

    if (err.code === 'PROTOCOL_SEQUENCE_TIMEOUT') {
      console.log('\n🔍 Troubleshooting:');
      console.log('1. Check if MySQL server is running on the configured DB_HOST');
      console.log('2. Verify port 3308 is open and not blocked by firewall');
      console.log('3. Test connection with: telnet <DB_HOST> <DB_PORT>');
      console.log('4. Check if user has remote access privileges');
    }
  } else {
    console.log('✅ Database connected successfully');
    console.log(`📊 Database: ${connection.config.database}`);
    console.log(`📍 Host: ${connection.config.host}:${connection.config.port}`);
    connection.release();
  }
});

// Export the pool
module.exports = pool;


