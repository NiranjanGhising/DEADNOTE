const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads', 'journal');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Get all journal entries
router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const { startDate, endDate, mood, search } = req.query;
    
    let query = `
        SELECT j.*, GROUP_CONCAT(ji.filename) as images
        FROM journal_entries j
        LEFT JOIN journal_images ji ON j.id = ji.journal_id
        WHERE j.user_id = ?
    `;
    const params = [req.session.userId];

    if (startDate) {
        query += ' AND j.entry_date >= ?';
        params.push(startDate);
    }
    if (endDate) {
        query += ' AND j.entry_date <= ?';
        params.push(endDate);
    }
    if (mood) {
        query += ' AND j.mood = ?';
        params.push(mood);
    }
    if (search) {
        query += ' AND (j.title LIKE ? OR j.content LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }

    query += ' GROUP BY j.id ORDER BY j.entry_date DESC, j.created_at DESC';

    try {
        const entries = db.prepare(query).all(...params);
        
        // Parse images into array
        entries.forEach(entry => {
            entry.images = entry.images ? entry.images.split(',') : [];
        });

        res.json(entries);
    } catch (error) {
        console.error('Get journal entries error:', error);
        res.status(500).json({ error: 'Failed to fetch journal entries' });
    }
});

// Get single entry
router.get('/:id', (req, res) => {
    const db = req.app.locals.db;
    
    try {
        const entry = db.prepare(`
            SELECT * FROM journal_entries 
            WHERE id = ? AND user_id = ?
        `).get(req.params.id, req.session.userId);

        if (!entry) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        const images = db.prepare(`
            SELECT * FROM journal_images WHERE journal_id = ?
        `).all(entry.id);

        entry.images = images;
        res.json(entry);
    } catch (error) {
        console.error('Get journal entry error:', error);
        res.status(500).json({ error: 'Failed to fetch journal entry' });
    }
});

// Create new entry
router.post('/', upload.array('images', 5), [
    body('title').optional().trim().isLength({ max: 200 }),
    body('content').notEmpty().withMessage('Content is required'),
    body('mood').optional().isIn(['amazing', 'good', 'neutral', 'bad', 'terrible']),
    body('entry_date').optional().isDate()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = req.app.locals.db;
    const { title, content, mood, mood_note, entry_date } = req.body;

    try {
        const result = db.prepare(`
            INSERT INTO journal_entries (user_id, title, content, mood, mood_note, entry_date)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            req.session.userId,
            title || null,
            content,
            mood || null,
            mood_note || null,
            entry_date || new Date().toISOString().split('T')[0]
        );

        const journalId = result.lastInsertRowid;

        // Save images
        if (req.files && req.files.length > 0) {
            const insertImage = db.prepare(`
                INSERT INTO journal_images (journal_id, filename, original_name)
                VALUES (?, ?, ?)
            `);

            req.files.forEach(file => {
                insertImage.run(journalId, file.filename, file.originalname);
            });
        }

        // Log activity
        db.prepare(`
            INSERT INTO activity_log (user_id, activity_type, details)
            VALUES (?, 'journal', ?)
        `).run(req.session.userId, `Created journal entry: ${title || 'Untitled'}`);

        res.status(201).json({ 
            message: 'Journal entry created',
            id: journalId
        });
    } catch (error) {
        console.error('Create journal entry error:', error);
        res.status(500).json({ error: 'Failed to create journal entry' });
    }
});

// Update entry
router.put('/:id', upload.array('images', 5), [
    body('title').optional().trim().isLength({ max: 200 }),
    body('content').notEmpty().withMessage('Content is required'),
    body('mood').optional().isIn(['amazing', 'good', 'neutral', 'bad', 'terrible'])
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = req.app.locals.db;
    const { title, content, mood, mood_note, entry_date } = req.body;

    try {
        // Check ownership
        const entry = db.prepare(`
            SELECT id FROM journal_entries WHERE id = ? AND user_id = ?
        `).get(req.params.id, req.session.userId);

        if (!entry) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        db.prepare(`
            UPDATE journal_entries 
            SET title = ?, content = ?, mood = ?, mood_note = ?, entry_date = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(title || null, content, mood || null, mood_note || null, entry_date, req.params.id);

        // Handle new images
        if (req.files && req.files.length > 0) {
            const insertImage = db.prepare(`
                INSERT INTO journal_images (journal_id, filename, original_name)
                VALUES (?, ?, ?)
            `);

            req.files.forEach(file => {
                insertImage.run(req.params.id, file.filename, file.originalname);
            });
        }

        res.json({ message: 'Journal entry updated' });
    } catch (error) {
        console.error('Update journal entry error:', error);
        res.status(500).json({ error: 'Failed to update journal entry' });
    }
});

// Delete entry
router.delete('/:id', (req, res) => {
    const db = req.app.locals.db;

    try {
        // Get images to delete
        const images = db.prepare(`
            SELECT filename FROM journal_images 
            WHERE journal_id = ? AND journal_id IN (
                SELECT id FROM journal_entries WHERE user_id = ?
            )
        `).all(req.params.id, req.session.userId);

        // Delete from database
        const result = db.prepare(`
            DELETE FROM journal_entries WHERE id = ? AND user_id = ?
        `).run(req.params.id, req.session.userId);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Entry not found' });
        }

        // Delete image files
        images.forEach(img => {
            const filePath = path.join(__dirname, '..', 'uploads', 'journal', img.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        });

        res.json({ message: 'Journal entry deleted' });
    } catch (error) {
        console.error('Delete journal entry error:', error);
        res.status(500).json({ error: 'Failed to delete journal entry' });
    }
});

// Delete specific image
router.delete('/:id/images/:imageId', (req, res) => {
    const db = req.app.locals.db;

    try {
        const image = db.prepare(`
            SELECT ji.* FROM journal_images ji
            JOIN journal_entries je ON ji.journal_id = je.id
            WHERE ji.id = ? AND je.user_id = ?
        `).get(req.params.imageId, req.session.userId);

        if (!image) {
            return res.status(404).json({ error: 'Image not found' });
        }

        db.prepare('DELETE FROM journal_images WHERE id = ?').run(req.params.imageId);

        // Delete file
        const filePath = path.join(__dirname, '..', 'uploads', 'journal', image.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.json({ message: 'Image deleted' });
    } catch (error) {
        console.error('Delete image error:', error);
        res.status(500).json({ error: 'Failed to delete image' });
    }
});

module.exports = router;
