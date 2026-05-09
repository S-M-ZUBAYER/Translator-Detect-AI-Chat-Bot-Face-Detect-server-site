// const express = require('express');
// const router = express.Router();

// // GET all unknown questions
// router.get('/chatBot/unknown-questions', async (req, res) => {
//     try {
//         const query = `
//             SELECT id, question, lang, product, 
//                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at 
//             FROM chatbot_unknown_question 
//             ORDER BY created_at DESC
//         `;

//         const results = await req.db.query(query);

//         res.json({
//             success: true,
//             count: results.length,
//             data: results
//         });
//     } catch (error) {
//         console.error('Error fetching unknown questions:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Failed to fetch questions',
//             message: error.message
//         });
//     }
// });

// // GET single question by ID
// router.get('/chatBot/unknown-questions/:id', async (req, res) => {
//     try {
//         const { id } = req.params;

//         const query = `
//             SELECT id, question, lang, product, 
//                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at 
//             FROM chatbot_unknown_question 
//             WHERE id = ?
//         `;

//         const results = await req.db.query(query, [id]);

//         if (results.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'Question not found'
//             });
//         }

//         res.json({
//             success: true,
//             data: results[0]
//         });
//     } catch (error) {
//         console.error('Error fetching question:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Failed to fetch question',
//             message: error.message
//         });
//     }
// });

// // POST - Add new unknown question (already in your chat endpoint)
// router.post('/chatBot/unknown-questions', async (req, res) => {
//     try {
//         const { question, lang, product } = req.body;

//         if (!question) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Question is required'
//             });
//         }

//         const query = `
//             INSERT INTO chatbot_unknown_question (question, lang, product) 
//             VALUES (?, ?, ?)
//         `;

//         const result = await req.db.query(query, [
//             question,
//             lang || 'en',
//             product || 'Face Attendance'
//         ]);

//         res.status(201).json({
//             success: true,
//             message: 'Question added successfully',
//             data: {
//                 id: result.insertId,
//                 question,
//                 lang: lang || 'en',
//                 product: product || 'Face Attendance'
//             }
//         });
//     } catch (error) {
//         console.error('Error adding question:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Failed to add question',
//             message: error.message
//         });
//     }
// });

// // PUT - Update question by ID
// router.put('/chatBot/unknown-questions/:id', async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { question, lang, product } = req.body;

//         // Check if question exists
//         const checkQuery = 'SELECT id FROM chatbot_unknown_question WHERE id = ?';
//         const existing = await req.db.query(checkQuery, [id]);

//         if (existing.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'Question not found'
//             });
//         }

//         // Prepare update fields
//         const updateFields = [];
//         const updateValues = [];

//         if (question !== undefined) {
//             updateFields.push('question = ?');
//             updateValues.push(question);
//         }

//         if (lang !== undefined) {
//             updateFields.push('lang = ?');
//             updateValues.push(lang);
//         }

//         if (product !== undefined) {
//             updateFields.push('product = ?');
//             updateValues.push(product);
//         }

//         // Add updated_at timestamp
//         updateFields.push('updated_at = CURRENT_TIMESTAMP');

//         if (updateFields.length === 1) { // Only updated_at was added
//             return res.status(400).json({
//                 success: false,
//                 error: 'No fields to update'
//             });
//         }

//         updateValues.push(id); // Add id for WHERE clause

//         const updateQuery = `
//             UPDATE chatbot_unknown_question 
//             SET ${updateFields.join(', ')} 
//             WHERE id = ?
//         `;

//         await req.db.query(updateQuery, updateValues);

//         // Get updated record
//         const getUpdatedQuery = `
//             SELECT id, question, lang, product, 
//                    DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at,
//                    DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at 
//             FROM chatbot_unknown_question 
//             WHERE id = ?
//         `;

//         const updatedResult = await req.db.query(getUpdatedQuery, [id]);

//         res.json({
//             success: true,
//             message: 'Question updated successfully',
//             data: updatedResult[0]
//         });
//     } catch (error) {
//         console.error('Error updating question:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Failed to update question',
//             message: error.message
//         });
//     }
// });

// // POST - Update question by ID
// router.post('/chatBot/unknown-questions/update', async (req, res) => {
//     try {
//         const { id, question, lang, product } = req.body;

//         if (!id) {
//             return res.status(400).json({ success: false, error: "ID required" });
//         }

//         const updateQuery = `
//       UPDATE chatbot_unknown_question
//       SET question = ?, lang = ?, product = ?, updated_at = CURRENT_TIMESTAMP
//       WHERE id = ?
//     `;

//         await req.db.query(updateQuery, [question, lang, product, id]);

//         res.json({
//             success: true,
//             message: "Question updated successfully"
//         });

//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             error: "Update failed"
//         });
//     }
// });

// // PATCH - Partially update question by ID
// router.patch('/chatBot/unknown-questions/:id', async (req, res) => {
//     try {
//         const { id } = req.params;
//         const updates = req.body;

//         if (!updates || Object.keys(updates).length === 0) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'No update data provided'
//             });
//         }

//         // Check if question exists
//         const checkQuery = 'SELECT id FROM chatbot_unknown_question WHERE id = ?';
//         const existing = await req.db.query(checkQuery, [id]);

//         if (existing.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'Question not found'
//             });
//         }

//         // Prepare update fields
//         const allowedFields = ['question', 'lang', 'product'];
//         const updateFields = [];
//         const updateValues = [];

//         Object.keys(updates).forEach(field => {
//             if (allowedFields.includes(field) && updates[field] !== undefined) {
//                 updateFields.push(`${field} = ?`);
//                 updateValues.push(updates[field]);
//             }
//         });

//         if (updateFields.length === 0) {
//             return res.status(400).json({
//                 success: false,
//                 error: 'No valid fields to update'
//             });
//         }

//         // Add updated_at timestamp
//         updateFields.push('updated_at = CURRENT_TIMESTAMP');
//         updateValues.push(id); // Add id for WHERE clause

//         const updateQuery = `
//             UPDATE chatbot_unknown_question 
//             SET ${updateFields.join(', ')} 
//             WHERE id = ?
//         `;

//         await req.db.query(updateQuery, updateValues);

//         res.json({
//             success: true,
//             message: 'Question partially updated successfully'
//         });
//     } catch (error) {
//         console.error('Error partially updating question:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Failed to update question',
//             message: error.message
//         });
//     }
// });

// // DELETE - Remove question by ID
// router.delete('/chatBot/unknown-questions/:id', async (req, res) => {
//     try {
//         const { id } = req.params;

//         // Check if question exists
//         const checkQuery = 'SELECT id, question FROM chatbot_unknown_question WHERE id = ?';
//         const existing = await req.db.query(checkQuery, [id]);

//         if (existing.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'Question not found'
//             });
//         }

//         const deleteQuery = 'DELETE FROM chatbot_unknown_question WHERE id = ?';
//         await req.db.query(deleteQuery, [id]);

//         res.json({
//             success: true,
//             message: 'Question deleted successfully',
//             data: {
//                 id: parseInt(id),
//                 question: existing[0].question,
//                 deleted: true
//             }
//         });
//     } catch (error) {
//         console.error('Error deleting question:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Failed to delete question',
//             message: error.message
//         });
//     }
// });

// // POST - Remove question by ID
// router.post('/chatBot/unknown-questions/delete', async (req, res) => {
//     try {
//         const { id } = req.body;

//         if (!id) {
//             return res.status(400).json({ success: false, error: "ID required" });
//         }

//         await req.db.query(
//             "DELETE FROM chatbot_unknown_question WHERE id = ?",
//             [id]
//         );

//         res.json({
//             success: true,
//             message: "Question deleted successfully"
//         });

//     } catch (error) {
//         res.status(500).json({
//             success: false,
//             error: "Delete failed"
//         });
//     }
// });


// // DELETE - Remove all questions (with optional filter)
// router.delete('/chatBot/unknown-questions', async (req, res) => {
//     try {
//         const { product, lang, days } = req.query;

//         let deleteQuery = 'DELETE FROM chatbot_unknown_question';
//         const conditions = [];
//         const queryParams = [];

//         // Add optional filters
//         if (product) {
//             conditions.push('product = ?');
//             queryParams.push(product);
//         }

//         if (lang) {
//             conditions.push('lang = ?');
//             queryParams.push(lang);
//         }

//         if (days) {
//             const daysAgo = parseInt(days);
//             if (!isNaN(daysAgo) && daysAgo > 0) {
//                 conditions.push('created_at < DATE_SUB(NOW(), INTERVAL ? DAY)');
//                 queryParams.push(daysAgo);
//             }
//         }

//         if (conditions.length > 0) {
//             deleteQuery += ' WHERE ' + conditions.join(' AND ');
//         }

//         // Get count before deletion for response
//         let countQuery = 'SELECT COUNT(*) as count FROM chatbot_unknown_question';
//         if (conditions.length > 0) {
//             countQuery += ' WHERE ' + conditions.join(' AND ');
//         }

//         const countResult = await req.db.query(countQuery, queryParams);
//         const recordCount = countResult[0].count;

//         if (recordCount === 0) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'No questions found to delete'
//             });
//         }

//         // Delete the records
//         const result = await req.db.query(deleteQuery, queryParams);

//         res.json({
//             success: true,
//             message: `Successfully deleted ${recordCount} question(s)`,
//             data: {
//                 deletedCount: recordCount,
//                 affectedRows: result.affectedRows,
//                 filters: {
//                     product: product || 'all',
//                     lang: lang || 'all',
//                     days: days || 'all'
//                 }
//             }
//         });
//     } catch (error) {
//         console.error('Error deleting all questions:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Failed to delete questions',
//             message: error.message
//         });
//     }
// });

// // GET - Statistics about unknown questions
// router.get('/chatBot/unknown-questions-stats', async (req, res) => {
//     try {
//         const statsQuery = `
//             SELECT 
//                 COUNT(*) as total_questions,
//                 COUNT(DISTINCT lang) as unique_languages,
//                 COUNT(DISTINCT product) as unique_products,
//                 MIN(created_at) as oldest_date,
//                 MAX(created_at) as newest_date
//             FROM chatbot_unknown_question
//         `;

//         const langDistributionQuery = `
//             SELECT lang, COUNT(*) as count 
//             FROM chatbot_unknown_question 
//             GROUP BY lang 
//             ORDER BY count DESC
//         `;

//         const productDistributionQuery = `
//             SELECT product, COUNT(*) as count 
//             FROM chatbot_unknown_question 
//             GROUP BY product 
//             ORDER BY count DESC
//         `;

//         const [stats, langDist, productDist] = await Promise.all([
//             req.db.query(statsQuery),
//             req.db.query(langDistributionQuery),
//             req.db.query(productDistributionQuery)
//         ]);

//         res.json({
//             success: true,
//             data: {
//                 overview: stats[0],
//                 languageDistribution: langDist,
//                 productDistribution: productDist,
//                 summary: {
//                     totalQuestions: stats[0].total_questions,
//                     topLanguage: langDist[0] || null,
//                     topProduct: productDist[0] || null
//                 }
//             }
//         });
//     } catch (error) {
//         console.error('Error fetching statistics:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Failed to fetch statistics',
//             message: error.message
//         });
//     }
// });

// module.exports = router;


const express = require('express');
const router = express.Router();

/**
 * @swagger
 * /chatBot/unknown-questions:
 *   get:
 *     summary: Get all unanswered chatbot questions
 *     description: Returns every question the chatbot could not answer, ordered by newest first.
 *     tags: [Unknown Questions]
 *     responses:
 *       200:
 *         description: List of unknown questions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 3
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UnknownQuestion'
 *       500:
 *         description: Database error
 */
router.get('/chatBot/unknown-questions', async (req, res) => {
    try {
        const query = `
            SELECT id, question, lang, product,
                   DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at
            FROM chatbot_unknown_question
            ORDER BY created_at DESC
        `;
        const results = await req.db.query(query);

        res.json({ success: true, count: results.length, data: results[0] });
    } catch (error) {
        console.error('Error fetching unknown questions:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch questions', message: error.message });
    }
});

/**
 * @swagger
 * /chatBot/unknown-questions/{id}:
 *   get:
 *     summary: Get a single unknown question by ID
 *     tags: [Unknown Questions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Question found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UnknownQuestion'
 *       404:
 *         description: Question not found
 *       500:
 *         description: Database error
 */
router.get('/chatBot/unknown-questions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT id, question, lang, product,
                   DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at
            FROM chatbot_unknown_question
            WHERE id = ?
        `;
        const results = await req.db.query(query, [id]);
        if (results.length === 0) {
            return res.status(404).json({ success: false, error: 'Question not found' });
        }
        res.json({ success: true, data: results[0] });
    } catch (error) {
        console.error('Error fetching question:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch question', message: error.message });
    }
});

/**
 * @swagger
 * /chatBot/unknown-questions:
 *   post:
 *     summary: Add a new unknown question
 *     tags: [Unknown Questions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUnknownQuestion'
 *     responses:
 *       201:
 *         description: Question added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/UnknownQuestion'
 *       400:
 *         description: Question field is required
 *       500:
 *         description: Database error
 */
router.post('/chatBot/unknown-questions', async (req, res) => {
    try {
        const { question, lang, product } = req.body;
        if (!question) {
            return res.status(400).json({ success: false, error: 'Question is required' });
        }
        const query = `INSERT INTO chatbot_unknown_question (question, lang, product) VALUES (?, ?, ?)`;
        const result = await req.db.query(query, [question, lang || 'en', product || 'Face Attendance']);
        res.status(201).json({
            success: true,
            message: 'Question added successfully',
            data: { id: result.insertId, question, lang: lang || 'en', product: product || 'Face Attendance' }
        });
    } catch (error) {
        console.error('Error adding question:', error);
        res.status(500).json({ success: false, error: 'Failed to add question', message: error.message });
    }
});

/**
 * @swagger
 * /chatBot/unknown-questions/{id}:
 *   put:
 *     summary: Fully update a question by ID
 *     tags: [Unknown Questions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUnknownQuestion'
 *     responses:
 *       200:
 *         description: Updated successfully
 *       400:
 *         description: No fields to update
 *       404:
 *         description: Question not found
 *       500:
 *         description: Database error
 */
router.put('/chatBot/unknown-questions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { question, lang, product } = req.body;

        const checkQuery = 'SELECT id FROM chatbot_unknown_question WHERE id = ?';
        const existing = await req.db.query(checkQuery, [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, error: 'Question not found' });
        }

        const updateFields = [];
        const updateValues = [];
        if (question !== undefined) { updateFields.push('question = ?'); updateValues.push(question); }
        if (lang !== undefined) { updateFields.push('lang = ?'); updateValues.push(lang); }
        if (product !== undefined) { updateFields.push('product = ?'); updateValues.push(product); }
        updateFields.push('updated_at = CURRENT_TIMESTAMP');

        if (updateFields.length === 1) {
            return res.status(400).json({ success: false, error: 'No fields to update' });
        }

        updateValues.push(id);
        const updateQuery = `UPDATE chatbot_unknown_question SET ${updateFields.join(', ')} WHERE id = ?`;
        await req.db.query(updateQuery, updateValues);

        const getUpdatedQuery = `
            SELECT id, question, lang, product,
                   DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at,
                   DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at
            FROM chatbot_unknown_question WHERE id = ?
        `;
        const updatedResult = await req.db.query(getUpdatedQuery, [id]);
        res.json({ success: true, message: 'Question updated successfully', data: updatedResult[0] });
    } catch (error) {
        console.error('Error updating question:', error);
        res.status(500).json({ success: false, error: 'Failed to update question', message: error.message });
    }
});

/**
 * @swagger
 * /chatBot/unknown-questions/update:
 *   post:
 *     summary: Update a question by ID (POST alternative to PUT)
 *     tags: [Unknown Questions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id]
 *             properties:
 *               id:
 *                 type: integer
 *                 example: 1
 *               question:
 *                 type: string
 *               lang:
 *                 type: string
 *               product:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated successfully
 *       400:
 *         description: ID is required
 *       500:
 *         description: Update failed
 */
router.post('/chatBot/unknown-questions/update', async (req, res) => {
    try {
        const { id, question, lang, product } = req.body;
        if (!id) return res.status(400).json({ success: false, error: "ID required" });

        const updateQuery = `
            UPDATE chatbot_unknown_question
            SET question = ?, lang = ?, product = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        await req.db.query(updateQuery, [question, lang, product, id]);
        res.json({ success: true, message: "Question updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Update failed" });
    }
});

/**
 * @swagger
 * /chatBot/unknown-questions/{id}:
 *   patch:
 *     summary: Partially update a question by ID
 *     tags: [Unknown Questions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               question:
 *                 type: string
 *               lang:
 *                 type: string
 *               product:
 *                 type: string
 *     responses:
 *       200:
 *         description: Partially updated successfully
 *       400:
 *         description: No valid fields to update
 *       404:
 *         description: Question not found
 *       500:
 *         description: Database error
 */
router.patch('/chatBot/unknown-questions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, error: 'No update data provided' });
        }

        const checkQuery = 'SELECT id FROM chatbot_unknown_question WHERE id = ?';
        const existing = await req.db.query(checkQuery, [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, error: 'Question not found' });
        }

        const allowedFields = ['question', 'lang', 'product'];
        const updateFields = [];
        const updateValues = [];
        Object.keys(updates).forEach(field => {
            if (allowedFields.includes(field) && updates[field] !== undefined) {
                updateFields.push(`${field} = ?`);
                updateValues.push(updates[field]);
            }
        });

        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid fields to update' });
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(id);
        const updateQuery = `UPDATE chatbot_unknown_question SET ${updateFields.join(', ')} WHERE id = ?`;
        await req.db.query(updateQuery, updateValues);
        res.json({ success: true, message: 'Question partially updated successfully' });
    } catch (error) {
        console.error('Error partially updating question:', error);
        res.status(500).json({ success: false, error: 'Failed to update question', message: error.message });
    }
});

/**
 * @swagger
 * /chatBot/unknown-questions/{id}:
 *   delete:
 *     summary: Delete a question by ID
 *     tags: [Unknown Questions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       404:
 *         description: Question not found
 *       500:
 *         description: Database error
 */
router.delete('/chatBot/unknown-questions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const checkQuery = 'SELECT id, question FROM chatbot_unknown_question WHERE id = ?';
        const existing = await req.db.query(checkQuery, [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, error: 'Question not found' });
        }
        const deleteQuery = 'DELETE FROM chatbot_unknown_question WHERE id = ?';
        await req.db.query(deleteQuery, [id]);
        res.json({ success: true, message: 'Question deleted successfully', data: { id: parseInt(id), question: existing[0].question, deleted: true } });
    } catch (error) {
        console.error('Error deleting question:', error);
        res.status(500).json({ success: false, error: 'Failed to delete question', message: error.message });
    }
});

/**
 * @swagger
 * /chatBot/unknown-questions/delete:
 *   post:
 *     summary: Delete a question by ID (POST alternative to DELETE)
 *     tags: [Unknown Questions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id]
 *             properties:
 *               id:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       400:
 *         description: ID required
 *       500:
 *         description: Delete failed
 */
router.post('/chatBot/unknown-questions/delete', async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ success: false, error: "ID required" });
        await req.db.query("DELETE FROM chatbot_unknown_question WHERE id = ?", [id]);
        res.json({ success: true, message: "Question deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Delete failed" });
    }
});

/**
 * @swagger
 * /chatBot/unknown-questions:
 *   delete:
 *     summary: Delete all questions with optional filters
 *     description: Delete questions optionally filtered by product, language, or age (days).
 *     tags: [Unknown Questions]
 *     parameters:
 *       - in: query
 *         name: product
 *         schema:
 *           type: string
 *         description: Filter by product name (e.g. "Thermal Printer")
 *       - in: query
 *         name: lang
 *         schema:
 *           type: string
 *         description: Filter by language code (e.g. "en", "zh")
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *         description: Delete records older than this many days
 *     responses:
 *       200:
 *         description: Deletion summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedCount:
 *                       type: integer
 *                     affectedRows:
 *                       type: integer
 *                     filters:
 *                       type: object
 *       404:
 *         description: No questions found matching filters
 *       500:
 *         description: Database error
 */
router.delete('/chatBot/unknown-questions', async (req, res) => {
    try {
        const { product, lang, days } = req.query;
        let deleteQuery = 'DELETE FROM chatbot_unknown_question';
        const conditions = [];
        const queryParams = [];

        if (product) { conditions.push('product = ?'); queryParams.push(product); }
        if (lang) { conditions.push('lang = ?'); queryParams.push(lang); }
        if (days) {
            const daysAgo = parseInt(days);
            if (!isNaN(daysAgo) && daysAgo > 0) {
                conditions.push('created_at < DATE_SUB(NOW(), INTERVAL ? DAY)');
                queryParams.push(daysAgo);
            }
        }

        if (conditions.length > 0) deleteQuery += ' WHERE ' + conditions.join(' AND ');

        let countQuery = 'SELECT COUNT(*) as count FROM chatbot_unknown_question';
        if (conditions.length > 0) countQuery += ' WHERE ' + conditions.join(' AND ');

        const countResult = await req.db.query(countQuery, queryParams);
        const recordCount = countResult[0].count;
        if (recordCount === 0) {
            return res.status(404).json({ success: false, error: 'No questions found to delete' });
        }

        const result = await req.db.query(deleteQuery, queryParams);
        res.json({
            success: true,
            message: `Successfully deleted ${recordCount} question(s)`,
            data: {
                deletedCount: recordCount,
                affectedRows: result.affectedRows,
                filters: { product: product || 'all', lang: lang || 'all', days: days || 'all' }
            }
        });
    } catch (error) {
        console.error('Error deleting all questions:', error);
        res.status(500).json({ success: false, error: 'Failed to delete questions', message: error.message });
    }
});

/**
 * @swagger
 * /chatBot/unknown-questions-stats:
 *   get:
 *     summary: Get statistics about unknown questions
 *     description: Returns totals, language distribution, and product distribution of unanswered questions.
 *     tags: [Unknown Questions]
 *     responses:
 *       200:
 *         description: Statistics returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StatsResponse'
 *       500:
 *         description: Database error
 */
router.get('/chatBot/unknown-questions-stats', async (req, res) => {

    try {
        const statsQuery = `
            SELECT COUNT(*) as total_questions, COUNT(DISTINCT lang) as unique_languages,
                   COUNT(DISTINCT product) as unique_products,
                   MIN(created_at) as oldest_date, MAX(created_at) as newest_date
            FROM chatbot_unknown_question
        `;
        const langDistributionQuery = `
            SELECT lang, COUNT(*) as count FROM chatbot_unknown_question
            GROUP BY lang ORDER BY count DESC
        `;
        const productDistributionQuery = `
            SELECT product, COUNT(*) as count FROM chatbot_unknown_question
            GROUP BY product ORDER BY count DESC
        `;
        const [stats, langDist, productDist] = await Promise.all([
            req.db.query(statsQuery),
            req.db.query(langDistributionQuery),
            req.db.query(productDistributionQuery)
        ]);
        res.json({
            success: true,
            data: {
                overview: stats[0],
                languageDistribution: langDist[0],
                productDistribution: productDist[0],
                summary: {
                    totalQuestions: stats[0].total_questions,
                    topLanguage: langDist[0] || null,
                    topProduct: productDist[0] || null
                }
            }
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch statistics', message: error.message });
    }
});

module.exports = router;