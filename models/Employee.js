const pool = require('../config/database');
const faceService = require('../services/faceRecognitionService');

class Employee {
    /** Create employee + optional face descriptor inside a transaction */
    static async create(employeeData) {
        const { employee_id, name, email, department, image_path, face_descriptor } = employeeData;
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [employeeResult] = await connection.execute(
                'INSERT INTO employees (employee_id, name, email, department, image_path) VALUES (?, ?, ?, ?, ?)',
                [employee_id, name, email || null, department || null, image_path]
            );
            const employeeId = employeeResult.insertId;

            if (face_descriptor && faceService.validateDescriptor(face_descriptor)) {
                await connection.execute(
                    'INSERT INTO face_descriptors (employee_id, descriptor_data, image_path) VALUES (?, ?, ?)',
                    [employeeId, JSON.stringify(face_descriptor), image_path]
                );
                await connection.execute(
                    'UPDATE employees SET face_descriptor = ? WHERE id = ?',
                    [JSON.stringify(face_descriptor), employeeId]
                );
            }

            await connection.commit();
            const [created] = await connection.execute('SELECT * FROM employees WHERE id = ?', [employeeId]);
            return created[0];
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async addFaceDescriptor(employeeId, descriptor, imagePath = null) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            await connection.execute(
                'INSERT INTO face_descriptors (employee_id, descriptor_data, image_path) VALUES (?, ?, ?)',
                [employeeId, JSON.stringify(descriptor), imagePath]
            );

            const [descriptors] = await connection.execute(
                'SELECT descriptor_data FROM face_descriptors WHERE employee_id = ?',
                [employeeId]
            );

            const avgDescriptor = this.calculateAverageDescriptor(
                descriptors.map(d => JSON.parse(d.descriptor_data))
            );

            await connection.execute(
                'UPDATE employees SET face_descriptor = ? WHERE id = ?',
                [JSON.stringify(avgDescriptor), employeeId]
            );

            await connection.commit();
            return avgDescriptor;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static calculateAverageDescriptor(descriptors) {
        if (descriptors.length === 0) return null;
        if (descriptors.length === 1) return descriptors[0];
        const length = descriptors[0].length;
        const avg = new Array(length).fill(0);
        for (const descriptor of descriptors) {
            for (let i = 0; i < length; i++) avg[i] += descriptor[i];
        }
        for (let i = 0; i < length; i++) avg[i] /= descriptors.length;
        return avg;
    }

    static async findAllWithDescriptors() {
        const [rows] = await pool.execute(`
            SELECT e.id, e.employee_id, e.name, e.email, e.department,
                   e.face_descriptor as main_descriptor,
                   GROUP_CONCAT(
                       DISTINCT CASE WHEN fd.descriptor_data IS NOT NULL AND fd.descriptor_data != ''
                           THEN fd.descriptor_data ELSE NULL END
                       ORDER BY fd.id SEPARATOR '|||'
                   ) as additional_descriptors
            FROM employees e
            LEFT JOIN face_descriptors fd ON e.id = fd.employee_id
            WHERE e.face_descriptor IS NOT NULL
            GROUP BY e.id
            HAVING main_descriptor IS NOT NULL
        `);
        return rows.map(row => {
            let descriptors = [];
            if (row.main_descriptor) {
                try {
                    const d = typeof row.main_descriptor === 'string' ? JSON.parse(row.main_descriptor) : row.main_descriptor;
                    if (Array.isArray(d) && d.length === 128) descriptors.push(d);
                } catch (_) { }
            }
            if (row.additional_descriptors) {
                row.additional_descriptors.split('|||').filter(Boolean).forEach(str => {
                    try {
                        const d = JSON.parse(str);
                        if (Array.isArray(d) && d.length === 128) descriptors.push(d);
                    } catch (_) { }
                });
            }
            const seen = new Set();
            const unique = descriptors.filter(d => {
                const k = JSON.stringify(d);
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
            });
            return { id: row.id, employee_id: row.employee_id, name: row.name, email: row.email, department: row.department, descriptors: unique };
        });
    }

    static async findById(id) {
        const [rows] = await pool.execute('SELECT * FROM employees WHERE id = ?', [id]);
        return rows[0];
    }

    static async findByEmployeeId(employeeId) {
        const [rows] = await pool.execute('SELECT * FROM employees WHERE employee_id = ?', [employeeId]);
        return rows[0];
    }

    static async search(query, limit = 50) {
        const q = `%${query}%`;
        const [rows] = await pool.execute(
            'SELECT * FROM employees WHERE name LIKE ? OR employee_id LIKE ? OR email LIKE ? LIMIT ?',
            [q, q, q, limit]
        );
        return rows;
    }

    static async update(id, updateData) {
        const fields = Object.keys(updateData);
        if (fields.length === 0) return null;
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = [...fields.map(f => updateData[f]), id];
        const [result] = await pool.execute(`UPDATE employees SET ${setClause} WHERE id = ?`, values);
        return result.affectedRows > 0 ? this.findById(id) : null;
    }

    static async delete(id) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute('DELETE FROM face_descriptors WHERE employee_id = ?', [id]);
            await connection.execute('DELETE FROM recognition_logs WHERE employee_id = ?', [id]);
            const [result] = await connection.execute('DELETE FROM employees WHERE id = ?', [id]);
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async logRecognition(employeeId, confidence, imagePath) {
        await pool.execute(
            'INSERT INTO recognition_logs (employee_id, confidence, image_path) VALUES (?, ?, ?)',
            [employeeId, confidence, imagePath]
        );
    }

    static async getRecognitionLogs(limit = 100, offset = 0) {
        const [logs] = await pool.execute(`
            SELECT rl.*, e.employee_id, e.name, e.department
            FROM recognition_logs rl
            LEFT JOIN employees e ON rl.employee_id = e.id
            ORDER BY rl.recognition_time DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);
        const [[{ count }]] = await pool.execute('SELECT COUNT(*) as count FROM recognition_logs');
        return { logs, total: count, limit, offset };
    }

    static async getStatistics() {
        const [[{ count: totalEmployees }]] = await pool.execute('SELECT COUNT(*) as count FROM employees');
        const [[{ count: employeesWithFaces }]] = await pool.execute('SELECT COUNT(*) as count FROM employees WHERE face_descriptor IS NOT NULL');
        const [[{ count: totalRecognitions }]] = await pool.execute('SELECT COUNT(*) as count FROM recognition_logs');
        const [[{ count: todayRecognitions }]] = await pool.execute(`SELECT COUNT(*) as count FROM recognition_logs WHERE DATE(recognition_time) = CURDATE()`);
        return { totalEmployees, employeesWithFaces, totalRecognitions, todayRecognitions };
    }
}

module.exports = Employee;