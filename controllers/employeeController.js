const Employee = require('../models/Employee');
const faceService = require('../services/faceRecognitionService');
const path = require('path');
const fs = require('fs').promises;
const pool = require('../config/database');

class EmployeeController {

    async addEmployee(req, res) {
        try {
            const { employee_id, name, email, department } = req.body;
            const image = req.file;

            if (!employee_id || !name || !image) {
                return res.status(400).json({ success: false, error: 'Employee ID, name, and image are required' });
            }

            const existingEmployee = await Employee.findByEmployeeId(employee_id);
            if (existingEmployee) {
                await fs.unlink(image.path).catch(console.error);
                return res.status(400).json({ success: false, error: `Employee with ID ${employee_id} already exists` });
            }

            const faceCheck = await faceService.isFaceAlreadyRegistered(image.path, 0.69);
            if (faceCheck.exists) {
                await fs.unlink(image.path).catch(console.error);
                return res.status(400).json({
                    success: false,
                    error: 'Face already registered',
                    details: {
                        message: `This face is already registered (confidence: ${faceCheck.confidence.toFixed(4)})`,
                        existing_employee: faceCheck.employee,
                        confidence: faceCheck.confidence,
                        suggestion: 'Upload a clearer image with a different angle/lighting',
                    },
                });
            }

            let faceDescriptor;
            try {
                faceDescriptor = await faceService.extractFaceDescriptor160(image.path);
            } catch (faceError) {
                await fs.unlink(image.path).catch(console.error);
                return res.status(400).json({ success: false, error: `Face detection failed: ${faceError.message}` });
            }

            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                const [empResult] = await connection.execute(
                    'INSERT INTO employees (employee_id, name, email, department, image_path) VALUES (?, ?, ?, ?, ?)',
                    [employee_id, name, email || null, department || null, image.filename]
                );
                const empId = empResult.insertId;

                await connection.execute(
                    'INSERT INTO face_descriptors (employee_id, descriptor_data, image_path) VALUES (?, ?, ?)',
                    [empId, JSON.stringify(faceDescriptor), image.filename]
                );
                await connection.execute(
                    'UPDATE employees SET face_descriptor = ? WHERE id = ?',
                    [JSON.stringify(faceDescriptor), empId]
                );

                await connection.commit();

                const [created] = await connection.execute('SELECT * FROM employees WHERE id = ?', [empId]);
                if (faceService.invalidateCache) await faceService.invalidateCache();

                res.status(201).json({
                    success: true,
                    message: 'Employee added successfully with 160x160 face descriptor',
                    warning: faceCheck.confidence > 0.69
                        ? `Note: Face similarity ${faceCheck.confidence.toFixed(4)} with existing employees`
                        : null,
                    data: created[0],
                });

            } catch (dbError) {
                await connection.rollback();
                throw dbError;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('❌ Error adding employee:', error);
            if (req.file) await fs.unlink(req.file.path).catch(console.error);
            res.status(500).json({ success: false, error: error.message || 'Failed to add employee' });
        }
    }

    async forceAddEmployee(req, res) {
        try {
            const { employee_id, name, email, department } = req.body;
            const image = req.file;

            if (!employee_id || !name || !image) {
                return res.status(400).json({ success: false, error: 'Employee ID, name, and image are required' });
            }

            const existingEmployee = await Employee.findByEmployeeId(employee_id);
            if (existingEmployee) {
                await fs.unlink(image.path).catch(console.error);
                return res.status(400).json({ success: false, error: `Employee with ID ${employee_id} already exists` });
            }

            let faceDescriptor;
            try {
                faceDescriptor = await faceService.extractFaceDescriptor160(image.path);
            } catch (faceError) {
                await fs.unlink(image.path).catch(console.error);
                return res.status(400).json({ success: false, error: `Face detection failed: ${faceError.message}` });
            }

            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();

                const [empResult] = await connection.execute(
                    'INSERT INTO employees (employee_id, name, email, department, image_path) VALUES (?, ?, ?, ?, ?)',
                    [employee_id, name, email || null, department || null, image.filename]
                );
                const empId = empResult.insertId;

                await connection.execute(
                    'INSERT INTO face_descriptors (employee_id, descriptor_data, image_path) VALUES (?, ?, ?)',
                    [empId, JSON.stringify(faceDescriptor), image.filename]
                );
                await connection.execute(
                    'UPDATE employees SET face_descriptor = ? WHERE id = ?',
                    [JSON.stringify(faceDescriptor), empId]
                );

                await connection.commit();
                const [created] = await connection.execute('SELECT * FROM employees WHERE id = ?', [empId]);
                if (faceService.invalidateCache) await faceService.invalidateCache();

                res.status(201).json({ success: true, message: 'Employee forcefully added (face check bypassed)', data: created[0] });

            } catch (dbError) {
                await connection.rollback();
                throw dbError;
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('❌ Error force adding employee:', error);
            if (req.file) await fs.unlink(req.file.path).catch(console.error);
            res.status(500).json({ success: false, error: error.message || 'Failed to add employee' });
        }
    }

    async addEmployeeFace(req, res) {
        try {
            const { employee_id } = req.params;
            const image = req.file;

            if (!image) return res.status(400).json({ success: false, error: 'Image is required' });

            const employee = await Employee.findByEmployeeId(employee_id);
            if (!employee) {
                await fs.unlink(image.path).catch(console.error);
                return res.status(404).json({ success: false, error: 'Employee not found' });
            }

            try {
                await faceService.registerEmployeeFace(image.path, employee_id);
            } catch (faceError) {
                await fs.unlink(image.path).catch(console.error);
                return res.status(400).json({ success: false, error: `Face detection failed: ${faceError.message}` });
            }

            res.json({ success: true, message: 'Additional 160x160 face image added successfully', data: { employee_id, image_path: image.filename } });

        } catch (error) {
            if (req.file) await fs.unlink(req.file.path).catch(console.error);
            res.status(500).json({ success: false, error: error.message || 'Failed to add face image' });
        }
    }

    async getAllEmployees(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const offset = (page - 1) * limit;

            const [employees] = await pool.execute('SELECT * FROM employees ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
            const [[{ total }]] = await pool.execute('SELECT COUNT(*) as total FROM employees');

            res.json({ success: true, data: employees, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
        } catch (error) {
            res.status(500).json({ success: false, error: 'Failed to fetch employees' });
        }
    }

    async getEmployeeById(req, res) {
        try {
            const employee = await Employee.findById(req.params.id);
            if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });
            res.json({ success: true, data: employee });
        } catch (error) {
            res.status(500).json({ success: false, error: 'Failed to fetch employee' });
        }
    }

    async searchEmployees(req, res) {
        try {
            const { q } = req.query;
            if (!q || q.trim().length < 2) {
                return res.status(400).json({ success: false, error: 'Search query must be at least 2 characters' });
            }
            const employees = await Employee.search(q.trim());
            res.json({ success: true, data: employees });
        } catch (error) {
            res.status(500).json({ success: false, error: 'Failed to search employees' });
        }
    }

    async updateEmployee(req, res) {
        try {
            const { id } = req.params;
            const updateData = { ...req.body };
            delete updateData.employee_id;
            delete updateData.face_descriptor;
            delete updateData.image_path;

            const updated = await Employee.update(id, updateData);
            if (!updated) return res.status(404).json({ success: false, error: 'Employee not found' });

            if (faceService.invalidateCache) await faceService.invalidateCache();
            res.json({ success: true, message: 'Employee updated successfully', data: updated });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message || 'Failed to update employee' });
        }
    }

    async deleteEmployee(req, res) {
        try {
            const { id } = req.params;
            const employee = await Employee.findById(id);
            if (!employee) return res.status(404).json({ success: false, error: 'Employee not found' });

            await Employee.delete(id);

            if (employee.image_path) {
                const imagePath = path.join(process.env.UPLOAD_PATH || './public/uploads', employee.image_path);
                await fs.unlink(imagePath).catch(console.error);
            }

            if (faceService.invalidateCache) await faceService.invalidateCache();
            res.json({ success: true, message: 'Employee deleted successfully' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message || 'Failed to delete employee' });
        }
    }

    async getStatistics(req, res) {
        try {
            const stats = await Employee.getStatistics();
            res.json({ success: true, data: stats });
        } catch (error) {
            res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
        }
    }
}

module.exports = new EmployeeController();