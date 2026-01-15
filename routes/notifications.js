const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Get notification settings
router.get('/settings', (req, res) => {
    const db = req.app.locals.db;

    try {
        let settings = db.prepare(`
            SELECT * FROM notification_settings WHERE user_id = ?
        `).get(req.session.userId);

        if (!settings) {
            // Create default settings
            db.prepare(`
                INSERT INTO notification_settings (user_id) VALUES (?)
            `).run(req.session.userId);
            
            settings = db.prepare(`
                SELECT * FROM notification_settings WHERE user_id = ?
            `).get(req.session.userId);
        }

        settings.reminder_times = JSON.parse(settings.reminder_times);
        res.json(settings);
    } catch (error) {
        console.error('Get notification settings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update notification settings
router.put('/settings', [
    body('reminder_enabled').optional().isBoolean(),
    body('motivation_enabled').optional().isBoolean(),
    body('pending_threshold').optional().isInt({ min: 1, max: 10 })
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = req.app.locals.db;
    const { reminder_enabled, reminder_times, motivation_enabled, pending_threshold } = req.body;

    try {
        const updates = [];
        const params = [];

        if (reminder_enabled !== undefined) {
            updates.push('reminder_enabled = ?');
            params.push(reminder_enabled ? 1 : 0);
        }
        if (reminder_times !== undefined) {
            updates.push('reminder_times = ?');
            params.push(JSON.stringify(reminder_times));
        }
        if (motivation_enabled !== undefined) {
            updates.push('motivation_enabled = ?');
            params.push(motivation_enabled ? 1 : 0);
        }
        if (pending_threshold !== undefined) {
            updates.push('pending_threshold = ?');
            params.push(pending_threshold);
        }

        if (updates.length > 0) {
            params.push(req.session.userId);
            db.prepare(`
                UPDATE notification_settings SET ${updates.join(', ')} WHERE user_id = ?
            `).run(...params);
        }

        res.json({ message: 'Settings updated' });
    } catch (error) {
        console.error('Update notification settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Get pending items for notification
router.get('/pending', (req, res) => {
    const db = req.app.locals.db;
    const today = new Date().toISOString().split('T')[0];

    try {
        // Get today's incomplete todos
        const pendingTodos = db.prepare(`
            SELECT * FROM todos 
            WHERE user_id = ? AND scheduled_date = ? AND is_completed = 0
            ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
        `).all(req.session.userId, today);

        // Get overdue todos
        const overdueTodos = db.prepare(`
            SELECT * FROM todos 
            WHERE user_id = ? AND scheduled_date < ? AND is_completed = 0
        `).all(req.session.userId, today);

        // Get active goals approaching deadline (within 7 days)
        const upcomingGoals = db.prepare(`
            SELECT * FROM goals 
            WHERE user_id = ? AND status = 'active' 
            AND target_date BETWEEN ? AND date(?, '+7 days')
        `).all(req.session.userId, today, today);

        res.json({
            pendingTodos,
            overdueTodos,
            upcomingGoals
        });
    } catch (error) {
        console.error('Get pending items error:', error);
        res.status(500).json({ error: 'Failed to fetch pending items' });
    }
});

module.exports = router;
