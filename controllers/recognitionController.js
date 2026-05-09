const faceService = require('../services/faceRecognitionService');
const fs = require('fs').promises;

class RecognitionController {

    async recognizeEmployee(req, res) {
        try {
            const image = req.file;
            if (!image) return res.status(400).json({ error: 'Image required' });

            const result = await faceService.recognizeFaceQuick(image.path);
            await fs.unlink(image.path).catch(console.error);
            res.json(result);

        } catch (error) {
            console.error('Recognition error:', error);
            if (req.file) await fs.unlink(req.file.path).catch(console.error);
            res.status(500).json({ error: error.message });
        }
    }

    async recognizeMultipleEmployees(req, res) {
        const image = req.file;
        if (!image) return res.status(400).json({ success: false, error: 'Image is required' });

        try {
            const result = await faceService.recognizeMultipleFacesQuick(image.path);
            fs.unlink(image.path).catch(console.error);

            if (!result.success) return res.status(400).json(result);

            const recognized = result.matches.filter(m => m.employee);
            const unknown = result.matches.filter(m => !m.employee);

            return res.json({
                success: true,
                total_faces: result.count,
                recognized: recognized.length,
                unknown: unknown.length,
                matches: recognized,
                unknown_faces: unknown.map(u => ({ confidence: u.confidence, box: u.box })),
                processingTime: result.processingTime,
            });

        } catch (error) {
            console.error('Error recognizing multiple:', error);
            if (req.file) fs.unlink(req.file.path).catch(console.error);
            return res.status(500).json({ success: false, error: error.message || 'Recognition failed' });
        }
    }

    async batchRecognize(req, res) {
        const images = req.files;

        if (!images || images.length === 0) {
            return res.status(400).json({ success: false, error: 'At least one image is required' });
        }
        if (images.length > 20) {
            images.forEach(img => fs.unlink(img.path).catch(console.error));
            return res.status(400).json({ success: false, error: 'Maximum 20 images allowed per batch' });
        }

        try {
            const startTime = Date.now();
            const results = [];
            const batchSize = 5;

            for (let i = 0; i < images.length; i += batchSize) {
                const batch = images.slice(i, i + batchSize);
                const batchResults = await Promise.all(
                    batch.map(async (image) => {
                        try {
                            const result = await faceService.recognizeFaceQuick(image.path);
                            if (result.success && result.employee) {
                                return { filename: image.originalname, success: true, employee: result.employee, confidence: result.match.confidence };
                            }
                            return { filename: image.originalname, success: false, error: result.error || 'No face detected or unknown' };
                        } catch (error) {
                            return { filename: image.originalname, success: false, error: error.message };
                        }
                    })
                );
                results.push(...batchResults);
            }

            images.forEach(img => fs.unlink(img.path).catch(console.error));

            const totalTime = Date.now() - startTime;
            const successful = results.filter(r => r.success).length;

            return res.json({
                success: true,
                summary: { total: results.length, successful, failed: results.length - successful, processingTime: totalTime, avgTimePerImage: Math.round(totalTime / results.length) },
                results,
            });

        } catch (error) {
            console.error('Batch error:', error);
            if (req.files) req.files.forEach(file => fs.unlink(file.path).catch(console.error));
            return res.status(500).json({ success: false, error: error.message || 'Batch processing failed' });
        }
    }

    async getCacheStatus(req, res) {
        try {
            const stats = faceService.getCacheStats();
            res.json({ success: true, cache: stats, system: { modelsLoaded: faceService.initialized, ready: faceService.faceMatcherReady } });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async refreshCache(req, res) {
        try {
            await faceService.invalidateCache();
            res.json({ success: true, message: 'Cache refreshed successfully', stats: faceService.getCacheStats() });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new RecognitionController();