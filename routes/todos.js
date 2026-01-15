const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Get todos with filtering
router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const { date, startDate, endDate, completed, priority } = req.query;

    let query = 'SELECT * FROM todos WHERE user_id = ?';
    const params = [req.session.userId];

    if (date) {
        query += ' AND scheduled_date = ?';
        params.push(date);
    }
    if (startDate) {
        query += ' AND scheduled_date >= ?';
        params.push(startDate);
    }
    if (endDate) {
        query += ' AND scheduled_date <= ?';
        params.push(endDate);
    }
    if (completed !== undefined) {
        query += ' AND is_completed = ?';
        params.push(completed === 'true' ? 1 : 0);
    }
    if (priority) {
        query += ' AND priority = ?';
        params.push(priority);
    }

    query += " ORDER BY scheduled_date ASC, CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, created_at ASC";

    try {
        const todos = db.prepare(query).all(...params);
        res.json(todos);
    } catch (error) {
        console.error('Get todos error:', error);
        res.status(500).json({ error: 'Failed to fetch todos' });
    }
});

// Get todos for today
router.get('/today', (req, res) => {
    const db = req.app.locals.db;
    const today = new Date().toISOString().split('T')[0];

    try {
        const todos = db.prepare(`
            SELECT * FROM todos 
            WHERE user_id = ? AND scheduled_date = ?
            ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, created_at ASC
        `).all(req.session.userId, today);

        res.json(todos);
    } catch (error) {
        console.error('Get today todos error:', error);
        res.status(500).json({ error: 'Failed to fetch todos' });
    }
});

// Get overdue todos
router.get('/overdue', (req, res) => {
    const db = req.app.locals.db;
    const today = new Date().toISOString().split('T')[0];

    try {
        const todos = db.prepare(`
            SELECT * FROM todos 
            WHERE user_id = ? AND scheduled_date < ? AND is_completed = 0
            ORDER BY scheduled_date ASC
        `).all(req.session.userId, today);

        res.json(todos);
    } catch (error) {
        console.error('Get overdue todos error:', error);
        res.status(500).json({ error: 'Failed to fetch overdue todos' });
    }
});

// Get upcoming todos (next 7 days)
router.get('/upcoming', (req, res) => {
    const db = req.app.locals.db;
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
        const todos = db.prepare(`
            SELECT * FROM todos 
            WHERE user_id = ? AND scheduled_date BETWEEN ? AND ? AND is_completed = 0
            ORDER BY scheduled_date ASC, CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
        `).all(req.session.userId, today, nextWeek);

        res.json(todos);
    } catch (error) {
        console.error('Get upcoming todos error:', error);
        res.status(500).json({ error: 'Failed to fetch upcoming todos' });
    }
});

// Create todo
router.post('/', [
    body('title').notEmpty().trim().withMessage('Title is required'),
    body('scheduled_date').isDate().withMessage('Valid date is required'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = req.app.locals.db;
    const { title, description, priority, scheduled_date } = req.body;

    try {
        const result = db.prepare(`
            INSERT INTO todos (user_id, title, description, priority, scheduled_date)
            VALUES (?, ?, ?, ?, ?)
        `).run(req.session.userId, title, description || null, priority || 'medium', scheduled_date);

        res.status(201).json({
            message: 'Todo created',
            id: result.lastInsertRowid
        });
    } catch (error) {
        console.error('Create todo error:', error);
        res.status(500).json({ error: 'Failed to create todo' });
    }
});

// Update todo
router.put('/:id', [
    body('title').optional().trim().notEmpty(),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('scheduled_date').optional().isDate()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = req.app.locals.db;
    const { title, description, priority, scheduled_date } = req.body;

    try {
        // Check ownership
        const todo = db.prepare(`
            SELECT id FROM todos WHERE id = ? AND user_id = ?
        `).get(req.params.id, req.session.userId);

        if (!todo) {
            return res.status(404).json({ error: 'Todo not found' });
        }

        const updates = [];
        const params = [];

        if (title !== undefined) {
            updates.push('title = ?');
            params.push(title);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (priority !== undefined) {
            updates.push('priority = ?');
            params.push(priority);
        }
        if (scheduled_date !== undefined) {
            updates.push('scheduled_date = ?');
            params.push(scheduled_date);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.params.id);

        db.prepare(`
            UPDATE todos SET ${updates.join(', ')} WHERE id = ?
        `).run(...params);

        res.json({ message: 'Todo updated' });
    } catch (error) {
        console.error('Update todo error:', error);
        res.status(500).json({ error: 'Failed to update todo' });
    }
});

// Toggle todo completion
router.patch('/:id/toggle', (req, res) => {
    const db = req.app.locals.db;

    try {
        const todo = db.prepare(`
            SELECT * FROM todos WHERE id = ? AND user_id = ?
        `).get(req.params.id, req.session.userId);

        if (!todo) {
            return res.status(404).json({ error: 'Todo not found' });
        }

        const newStatus = todo.is_completed ? 0 : 1;
        db.prepare(`
            UPDATE todos 
            SET is_completed = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(newStatus, newStatus ? new Date().toISOString() : null, req.params.id);

        // Log activity if completed
        if (newStatus) {
            db.prepare(`
                INSERT INTO activity_log (user_id, activity_type, details)
                VALUES (?, 'todo_completed', ?)
            `).run(req.session.userId, `Completed: ${todo.title}`);
        }

        res.json({ 
            message: 'Todo updated',
            is_completed: newStatus === 1
        });
    } catch (error) {
        console.error('Toggle todo error:', error);
        res.status(500).json({ error: 'Failed to update todo' });
    }
});

// Delete todo
router.delete('/:id', (req, res) => {
    const db = req.app.locals.db;

    try {
        const result = db.prepare(`
            DELETE FROM todos WHERE id = ? AND user_id = ?
        `).run(req.params.id, req.session.userId);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Todo not found' });
        }

        res.json({ message: 'Todo deleted' });
    } catch (error) {
        console.error('Delete todo error:', error);
        res.status(500).json({ error: 'Failed to delete todo' });
    }
});

// Bulk operations
router.post('/bulk-complete', (req, res) => {
    const db = req.app.locals.db;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Invalid todo IDs' });
    }

    try {
        const placeholders = ids.map(() => '?').join(',');
        db.prepare(`
            UPDATE todos 
            SET is_completed = 1, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id IN (${placeholders}) AND user_id = ?
        `).run(...ids, req.session.userId);

        res.json({ message: 'Todos completed' });
    } catch (error) {
        console.error('Bulk complete error:', error);
        res.status(500).json({ error: 'Failed to complete todos' });
    }
});

// Reschedule overdue todos
router.post('/reschedule-overdue', (req, res) => {
    const db = req.app.locals.db;
    const { newDate } = req.body;

    if (!newDate) {
        return res.status(400).json({ error: 'New date is required' });
    }

    const today = new Date().toISOString().split('T')[0];

    try {
        const result = db.prepare(`
            UPDATE todos 
            SET scheduled_date = ?, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND scheduled_date < ? AND is_completed = 0
        `).run(newDate, req.session.userId, today);

        res.json({ 
            message: 'Overdue todos rescheduled',
            count: result.changes
        });
    } catch (error) {
        console.error('Reschedule error:', error);
        res.status(500).json({ error: 'Failed to reschedule todos' });
    }
});

module.exports = router;
