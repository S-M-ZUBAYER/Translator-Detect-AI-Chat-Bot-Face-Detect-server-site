const pool = require('../config/database');

class MySQLService {
    static async query(sql, params = []) {
        try {
            const [rows] = await pool.execute(sql, params);
            return rows;
        } catch (error) {
            console.error('MySQL Query Error:', error.message);
            throw error;
        }
    }

    static async transaction(callback) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const result = await callback(connection);
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async tableExists(tableName) {
        const [rows] = await pool.execute(
            `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?`,
            [process.env.DB_NAME, tableName]
        );
        return rows[0].count > 0;
    }

    static async ensureTables() {
        const tables = [
            `CREATE TABLE IF NOT EXISTS employees (
                id              INT PRIMARY KEY AUTO_INCREMENT,
                employee_id     VARCHAR(50) UNIQUE NOT NULL,
                name            VARCHAR(100) NOT NULL,
                email           VARCHAR(100),
                department      VARCHAR(100),
                image_path      VARCHAR(500),
                face_descriptor JSON,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS face_descriptors (
                id              INT PRIMARY KEY AUTO_INCREMENT,
                employee_id     INT NOT NULL,
                descriptor_data JSON NOT NULL,
                image_path      VARCHAR(500),
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
            )`,
            `CREATE TABLE IF NOT EXISTS recognition_logs (
                id               INT PRIMARY KEY AUTO_INCREMENT,
                employee_id      INT,
                confidence       DECIMAL(5,4),
                image_path       VARCHAR(500),
                recognition_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
            )`,
        ];

        for (const sql of tables) {
            try {
                await pool.execute(sql);
            } catch (error) {
                console.error('Error creating table:', error.message);
            }
        }
        console.log('✅ Face Recognition database tables verified/created');
    }
}

module.exports = MySQLService;