const pool = require('../config/database');

class FaceDescriptor {
    static async add(employeeId, descriptor, imagePath = null) {
        const [result] = await pool.execute(
            'INSERT INTO face_descriptors (employee_id, descriptor_data, image_path) VALUES (?, ?, ?)',
            [employeeId, JSON.stringify(descriptor), imagePath]
        );
        return result.insertId;
    }

    static async findByEmployeeId(employeeId) {
        const [rows] = await pool.execute(
            'SELECT * FROM face_descriptors WHERE employee_id = ? ORDER BY created_at DESC',
            [employeeId]
        );
        return rows.map(row => ({ ...row, descriptor_data: JSON.parse(row.descriptor_data) }));
    }

    static async delete(id) {
        const [result] = await pool.execute('DELETE FROM face_descriptors WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    static async deleteByEmployeeId(employeeId) {
        const [result] = await pool.execute('DELETE FROM face_descriptors WHERE employee_id = ?', [employeeId]);
        return result.affectedRows;
    }

    static async findById(id) {
        const [rows] = await pool.execute('SELECT * FROM face_descriptors WHERE id = ?', [id]);
        if (rows.length === 0) return null;
        return { ...rows[0], descriptor_data: JSON.parse(rows[0].descriptor_data) };
    }

    static async findAllWithEmployeeInfo() {
        const [rows] = await pool.execute(`
            SELECT fd.*, e.employee_id, e.name, e.department
            FROM face_descriptors fd
            JOIN employees e ON fd.employee_id = e.id
            ORDER BY fd.created_at DESC
        `);
        return rows.map(row => ({ ...row, descriptor_data: JSON.parse(row.descriptor_data) }));
    }

    static calculateAverage(descriptors) {
        if (!descriptors || descriptors.length === 0) return null;
        if (descriptors.length === 1) return descriptors[0];
        const length = descriptors[0].length;
        const avg = new Array(length).fill(0);
        for (const d of descriptors) for (let i = 0; i < length; i++) avg[i] += d[i];
        for (let i = 0; i < length; i++) avg[i] /= descriptors.length;
        return avg;
    }
}

module.exports = FaceDescriptor;