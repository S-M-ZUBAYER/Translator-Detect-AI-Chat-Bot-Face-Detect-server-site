const faceapi = require('face-api.js');
const fs = require('fs').promises;
const path = require('path');
const tf = require('@tensorflow/tfjs');
const jpeg = require('jpeg-js');
const sharp = require('sharp');
require('dotenv').config();

class FaceRecognitionService {
    constructor() {
        this.initialized = false;
        this.faceMatcher = null;
        this.labeledDescriptors = [];
        this.modelPath = process.env.MODEL_PATH || './face-models';
        this.threshold = parseFloat(process.env.FACE_MATCH_THRESHOLD) || 0.6;

        this.useTinyFaceDetector = true;
        this.skipLandmarks = true;
        this.FACE_SIZE = 128;

        this.employeesCache = [];
        this.cacheLastUpdated = null;
        this.faceMatcherReady = false;
    }

    async initialize() {
        if (this.initialized) return;
        console.log('📦 Loading face recognition models...');
        const start = Date.now();

        try {
            if (this.useTinyFaceDetector) {
                await faceapi.nets.tinyFaceDetector.loadFromDisk(this.modelPath);
                await faceapi.nets.faceRecognitionNet.loadFromDisk(this.modelPath);
                if (!this.skipLandmarks) {
                    await faceapi.nets.faceLandmark68Net.loadFromDisk(this.modelPath);
                }
            } else {
                await faceapi.nets.ssdMobilenetv1.loadFromDisk(this.modelPath);
                await faceapi.nets.faceRecognitionNet.loadFromDisk(this.modelPath);
                if (!this.skipLandmarks) {
                    await faceapi.nets.faceLandmark68Net.loadFromDisk(this.modelPath);
                }
            }
            this.initialized = true;
            console.log(`✅ Models loaded in ${Date.now() - start}ms`);
        } catch (error) {
            console.error('❌ Error loading models:', error.message);
            throw error;
        }
    }

    getDetectionOptions() {
        if (this.useTinyFaceDetector) {
            return new faceapi.TinyFaceDetectorOptions({ inputSize: this.FACE_SIZE, scoreThreshold: 0.5 });
        }
        return new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5, maxResults: 1 });
    }

    async resizeImage(imagePath, size = this.FACE_SIZE) {
        const buffer = await sharp(imagePath)
            .resize(size, size, { fit: 'cover', position: 'center' })
            .jpeg({ quality: 85, chromaSubsampling: '4:4:4' })
            .toBuffer();
        return jpeg.decode(buffer);
    }

    async extractFaceDescriptorFast(imagePath) {
        await this.initialize();
        try {
            const img = await this.resizeImage(imagePath, this.FACE_SIZE);
            const tensor = tf.tensor3d(new Uint8Array(img.data), [img.height, img.width, 4]);
            const rgbTensor = tensor.shape[2] === 4 ? tensor.slice([0, 0, 0], [-1, -1, 3]) : tensor;
            if (tensor !== rgbTensor) tensor.dispose();

            const detectionOptions = this.getDetectionOptions();
            const detection = await faceapi.detectSingleFace(rgbTensor, detectionOptions);
            if (!detection) throw new Error('No face detected in the image,for register');

            const faceDescriptor = await faceapi.computeFaceDescriptor(rgbTensor, detection);
            rgbTensor.dispose();
            return Array.from(faceDescriptor);

        } catch (error) {
            if (this.useTinyFaceDetector && error.message.includes('TinyYolov2')) {
                this.useTinyFaceDetector = false;
                return this.extractFaceDescriptorFast(imagePath);
            }
            throw error;
        }
    }

    async extractFaceDescriptor160(imagePath) {
        this.FACE_SIZE = 160;
        const descriptor = await this.extractFaceDescriptorFast(imagePath);
        this.FACE_SIZE = 128;
        return descriptor;
    }

    async registerEmployeeFace(imagePath, employeeId) {
        const descriptor = await this.extractFaceDescriptorFast(imagePath);
        const pool = require('../config/database');
        const Employee = require('../models/Employee');

        const employee = await Employee.findByEmployeeId(employeeId);
        if (!employee) throw new Error('Employee not found');

        await pool.execute(
            'INSERT INTO face_descriptors (employee_id, descriptor_data, image_path) VALUES (?, ?, ?)',
            [employee.id, JSON.stringify(descriptor), path.basename(imagePath)]
        );
        await this.invalidateCache();
        return descriptor;
    }

    async invalidateCache() {
        this.faceMatcher = null;
        this.labeledDescriptors = [];
        this.faceMatcherReady = false;
        await this.preloadEmployees();
    }

    async loadEmployeesFromDB() {
        const pool = require('../config/database');
        const [rows] = await pool.execute(`
            SELECT e.employee_id, e.name, e.email, e.department,
                   e.face_descriptor,
                   CASE WHEN COUNT(fd.id) = 0 THEN '[]'
                        ELSE CONCAT('[', GROUP_CONCAT(fd.descriptor_data ORDER BY fd.id), ']')
                   END as all_descriptors
            FROM employees e
            LEFT JOIN face_descriptors fd ON e.id = fd.employee_id
            WHERE e.face_descriptor IS NOT NULL
            GROUP BY e.id
        `);
        console.log(rows, "employee")
        return rows.map(row => {
            const descriptors = [];
            if (row.face_descriptor) {
                try {
                    const d = typeof row.face_descriptor === 'string' ? JSON.parse(row.face_descriptor) : row.face_descriptor;
                    if (this.validateDescriptor(d)) descriptors.push(d);
                } catch (_) { }
            }
            if (row.all_descriptors) {
                try {
                    const all = typeof row.all_descriptors === 'string' ? JSON.parse(row.all_descriptors) : row.all_descriptors;
                    if (Array.isArray(all)) {
                        all.forEach(desc => {
                            try {
                                const d = typeof desc === 'string' ? JSON.parse(desc) : desc;
                                if (this.validateDescriptor(d)) descriptors.push(d);
                            } catch (_) { }
                        });
                    }
                } catch (_) { }
            }
            return { employee_id: row.employee_id, name: row.name, email: row.email, department: row.department, descriptors };
        });
    }

    async buildFaceMatcher() {
        if (this.employeesCache.length === 0) return null;
        this.labeledDescriptors = [];

        for (const employee of this.employeesCache) {
            const float32Descriptors = employee.descriptors
                .filter(d => this.validateDescriptor(d))
                .map(d => new Float32Array(d));

            if (float32Descriptors.length > 0) {
                this.labeledDescriptors.push(
                    new faceapi.LabeledFaceDescriptors(employee.employee_id.toString(), float32Descriptors)
                );
            }
        }

        if (this.labeledDescriptors.length === 0) return null;
        this.faceMatcher = new faceapi.FaceMatcher(this.labeledDescriptors, this.threshold);
        this.faceMatcherReady = true;
        return this.faceMatcher;
    }

    async preloadEmployees() {
        try {
            this.employeesCache = await this.loadEmployeesFromDB();
            this.cacheLastUpdated = Date.now();
            await this.buildFaceMatcher();
            console.log(`✅ Preloaded ${this.employeesCache.length} employees into face cache`);
        } catch (error) {
            console.error('Error preloading employees:', error);
        }
    }

    async findBestMatchFromAllDescriptors(queryDescriptor, minConfidence = 0.55) {
        if (!this.employeesCache || this.employeesCache.length === 0) {
            return { label: 'unknown', distance: 1.0, confidence: 0, employee: null };
        }

        let bestMatch = { label: 'unknown', distance: 1.0, confidence: 0, employee: null };
        const queryArray = new Float32Array(queryDescriptor);

        for (const employee of this.employeesCache) {
            if (!employee.descriptors || employee.descriptors.length === 0) continue;
            for (const descriptor of employee.descriptors) {
                if (!this.validateDescriptor(descriptor)) continue;
                const distance = faceapi.euclideanDistance(queryArray, new Float32Array(descriptor));
                const confidence = Math.max(0, 1 - distance);
                if (distance < bestMatch.distance) {
                    bestMatch = { label: employee.employee_id.toString(), distance, confidence, employee };
                }
            }
        }

        return bestMatch.confidence >= minConfidence ? bestMatch
            : { label: 'unknown', distance: bestMatch.distance, confidence: bestMatch.confidence, employee: null };
    }

    async isFaceAlreadyRegistered(imagePath, threshold = 0.65) {
        if (!this.initialized) await this.initialize();
        if (!this.faceMatcherReady) await this.preloadEmployees();

        try {
            const queryDescriptor = await this.extractFaceDescriptorFast(imagePath);
            if (!queryDescriptor) return { exists: false, error: 'No face detected' };

            const bestMatch = await this.findBestMatchFromAllDescriptors(queryDescriptor);

            if (bestMatch.distance <= (1 - threshold)) {
                return { exists: true, match: bestMatch, employee: bestMatch.employee, confidence: 1 - bestMatch.distance };
            }
            return { exists: false, confidence: 1 - bestMatch.distance };
        } catch (error) {
            return { exists: false, error: error.message };
        }
    }

    async recognizeFaceQuick(imagePath) {
        if (!this.initialized) await this.initialize();
        if (!this.faceMatcherReady) await this.preloadEmployees();
        if (this.employeesCache.length === 0) return { success: false, error: 'No employees registered' };

        const startTime = Date.now();
        try {
            const uploadedDescriptor = await this.extractFaceDescriptorFast(imagePath);
            const extractionTime = Date.now() - startTime;

            if (!uploadedDescriptor) return { success: false, error: 'No face detected in the image' };

            const matchStart = Date.now();
            const bestMatch = await this.findBestMatchFromAllDescriptors(uploadedDescriptor);
            const matchTime = Date.now() - matchStart;

            const isMatch = bestMatch.label !== 'unknown';
            let employeeDetails = null;

            if (isMatch) {
                const employee = this.employeesCache.find(emp => emp.employee_id.toString() === bestMatch.label);
                if (employee) {
                    employeeDetails = { employee_id: employee.employee_id, name: employee.name, email: employee.email, department: employee.department };
                }
            }

            const totalTime = Date.now() - startTime;
            return {
                success: true,
                match: { employeeId: isMatch ? bestMatch.label : null, distance: bestMatch.distance, confidence: bestMatch.confidence || Math.max(0, 1 - bestMatch.distance) },
                employee: employeeDetails,
                timing: { total_ms: totalTime, extraction_ms: extractionTime, matching_ms: matchTime },
            };
        } catch (error) {
            return { success: false, error: `Recognition failed: ${error.message}` };
        }
    }

    // Stub for multiple faces — extend if needed
    async recognizeMultipleFacesQuick(imagePath) {
        const single = await this.recognizeFaceQuick(imagePath);
        return {
            success: single.success,
            count: single.success ? 1 : 0,
            matches: single.success ? [single] : [],
            processingTime: single.timing?.total_ms || 0,
        };
    }

    getCacheStats() {
        return {
            employeesLoaded: this.employeesCache.length,
            faceMatcherReady: this.faceMatcherReady,
            labeledDescriptorsCount: this.labeledDescriptors ? this.labeledDescriptors.length : 0,
            cacheAge: this.cacheLastUpdated ? Date.now() - this.cacheLastUpdated : null,
        };
    }

    validateDescriptor(descriptor) {
        return descriptor &&
            Array.isArray(descriptor) &&
            descriptor.length === 128 &&
            descriptor.every(val => typeof val === 'number' && !isNaN(val));
    }
}

module.exports = new FaceRecognitionService();