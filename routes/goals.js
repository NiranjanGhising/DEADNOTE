const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Get all goals
router.get('/', (req, res) => {
    const db = req.app.locals.db;
    const { type, status } = req.query;

    let query = `
        SELECT g.*, 
            (SELECT COUNT(*) FROM goal_milestones WHERE goal_id = g.id) as total_milestones,
            (SELECT COUNT(*) FROM goal_milestones WHERE goal_id = g.id AND is_completed = 1) as completed_milestones
        FROM goals g
        WHERE g.user_id = ?
    `;
    const params = [req.session.userId];

    if (type) {
        query += ' AND g.goal_type = ?';
        params.push(type);
    }
    if (status) {
        query += ' AND g.status = ?';
        params.push(status);
    }

    query += ' ORDER BY g.created_at DESC';

    try {
        const goals = db.prepare(query).all(...params);

        // Get milestones for each goal
        const getMilestones = db.prepare('SELECT * FROM goal_milestones WHERE goal_id = ? ORDER BY created_at');
        goals.forEach(goal => {
            goal.milestones = getMilestones.all(goal.id);
        });

        res.json(goals);
    } catch (error) {
        console.error('Get goals error:', error);
        res.status(500).json({ error: 'Failed to fetch goals' });
    }
});

// Get single goal
router.get('/:id', (req, res) => {
    const db = req.app.locals.db;

    try {
        const goal = db.prepare(`
            SELECT * FROM goals WHERE id = ? AND user_id = ?
        `).get(req.params.id, req.session.userId);

        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        goal.milestones = db.prepare(`
            SELECT * FROM goal_milestones WHERE goal_id = ? ORDER BY created_at
        `).all(goal.id);

        res.json(goal);
    } catch (error) {
        console.error('Get goal error:', error);
        res.status(500).json({ error: 'Failed to fetch goal' });
    }
});

// Create goal
router.post('/', [
    body('title').notEmpty().trim().withMessage('Title is required'),
    body('goal_type').isIn(['short-term', 'long-term']).withMessage('Invalid goal type'),
    body('target_date').optional().isDate(),
    body('milestones').optional().isArray()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = req.app.locals.db;
    const { title, description, goal_type, target_date, milestones } = req.body;

    try {
        const result = db.prepare(`
            INSERT INTO goals (user_id, title, description, goal_type, target_date)
            VALUES (?, ?, ?, ?, ?)
        `).run(req.session.userId, title, description || null, goal_type, target_date || null);

        const goalId = result.lastInsertRowid;

        // Add milestones
        if (milestones && milestones.length > 0) {
            const insertMilestone = db.prepare(`
                INSERT INTO goal_milestones (goal_id, title) VALUES (?, ?)
            `);
            milestones.forEach(m => {
                if (m.title && m.title.trim()) {
                    insertMilestone.run(goalId, m.title.trim());
                }
            });
        }

        res.status(201).json({
            message: 'Goal created',
            id: goalId
        });
    } catch (error) {
        console.error('Create goal error:', error);
        res.status(500).json({ error: 'Failed to create goal' });
    }
});

// Update goal
router.put('/:id', [
    body('title').optional().trim().notEmpty(),
    body('progress').optional().isInt({ min: 0, max: 100 }),
    body('status').optional().isIn(['active', 'completed', 'paused', 'cancelled'])
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = req.app.locals.db;
    const { title, description, target_date, progress, status } = req.body;

    try {
        // Check ownership
        const goal = db.prepare(`
            SELECT * FROM goals WHERE id = ? AND user_id = ?
        `).get(req.params.id, req.session.userId);

        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
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
        if (target_date !== undefined) {
            updates.push('target_date = ?');
            params.push(target_date);
        }
        if (progress !== undefined) {
            updates.push('progress = ?');
            params.push(progress);

            // Log progress update
            db.prepare(`
                INSERT INTO activity_log (user_id, activity_type, details)
                VALUES (?, 'goal_progress', ?)
            `).run(req.session.userId, `Goal "${goal.title}" progress: ${progress}%`);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);
            if (status === 'completed') {
                updates.push('completed_at = CURRENT_TIMESTAMP');
            }
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.params.id);

        db.prepare(`
            UPDATE goals SET ${updates.join(', ')} WHERE id = ?
        `).run(...params);

        res.json({ message: 'Goal updated' });
    } catch (error) {
        console.error('Update goal error:', error);
        res.status(500).json({ error: 'Failed to update goal' });
    }
});

// Delete goal
router.delete('/:id', (req, res) => {
    const db = req.app.locals.db;

    try {
        const result = db.prepare(`
            DELETE FROM goals WHERE id = ? AND user_id = ?
        `).run(req.params.id, req.session.userId);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        res.json({ message: 'Goal deleted' });
    } catch (error) {
        console.error('Delete goal error:', error);
        res.status(500).json({ error: 'Failed to delete goal' });
    }
});

// Add milestone to goal
router.post('/:id/milestones', [
    body('title').notEmpty().trim().withMessage('Milestone title is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = req.app.locals.db;

    try {
        // Check ownership
        const goal = db.prepare(`
            SELECT id FROM goals WHERE id = ? AND user_id = ?
        `).get(req.params.id, req.session.userId);

        if (!goal) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        const result = db.prepare(`
            INSERT INTO goal_milestones (goal_id, title) VALUES (?, ?)
        `).run(req.params.id, req.body.title);

        res.status(201).json({
            message: 'Milestone added',
            id: result.lastInsertRowid
        });
    } catch (error) {
        console.error('Add milestone error:', error);
        res.status(500).json({ error: 'Failed to add milestone' });
    }
});

// Toggle milestone completion
router.patch('/:goalId/milestones/:milestoneId/toggle', (req, res) => {
    const db = req.app.locals.db;

    try {
        // Check ownership
        const milestone = db.prepare(`
            SELECT gm.* FROM goal_milestones gm
            JOIN goals g ON gm.goal_id = g.id
            WHERE gm.id = ? AND g.user_id = ?
        `).get(req.params.milestoneId, req.session.userId);

        if (!milestone) {
            return res.status(404).json({ error: 'Milestone not found' });
        }

        const newStatus = milestone.is_completed ? 0 : 1;
        db.prepare(`
            UPDATE goal_milestones 
            SET is_completed = ?, completed_at = ?
            WHERE id = ?
        `).run(newStatus, newStatus ? new Date().toISOString() : null, req.params.milestoneId);

        // Auto-update goal progress based on milestones
        const stats = db.prepare(`
            SELECT COUNT(*) as total, SUM(is_completed) as completed
            FROM goal_milestones WHERE goal_id = ?
        `).get(req.params.goalId);

        if (stats.total > 0) {
            const progress = Math.round((stats.completed / stats.total) * 100);
            db.prepare(`
                UPDATE goals SET progress = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
            `).run(progress, req.params.goalId);
        }

        res.json({ 
            message: 'Milestone updated',
            is_completed: newStatus === 1
        });
    } catch (error) {
        console.error('Toggle milestone error:', error);
        res.status(500).json({ error: 'Failed to update milestone' });
    }
});

// Delete milestone
router.delete('/:goalId/milestones/:milestoneId', (req, res) => {
    const db = req.app.locals.db;

    try {
        const result = db.prepare(`
            DELETE FROM goal_milestones 
            WHERE id = ? AND goal_id IN (
                SELECT id FROM goals WHERE user_id = ?
            )
        `).run(req.params.milestoneId, req.session.userId);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Milestone not found' });
        }

        res.json({ message: 'Milestone deleted' });
    } catch (error) {
        console.error('Delete milestone error:', error);
        res.status(500).json({ error: 'Failed to delete milestone' });
    }
});

module.exports = router;
