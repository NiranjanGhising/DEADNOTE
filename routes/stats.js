const express = require('express');
const router = express.Router();

// Get dashboard stats
router.get('/dashboard', (req, res) => {
    const db = req.app.locals.db;
    const today = new Date().toISOString().split('T')[0];

    try {
        // Today's todos
        const todayTodos = db.prepare(`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed
            FROM todos WHERE user_id = ? AND scheduled_date = ?
        `).get(req.session.userId, today);

        // Overdue todos
        const overdueTodos = db.prepare(`
            SELECT COUNT(*) as count
            FROM todos WHERE user_id = ? AND scheduled_date < ? AND is_completed = 0
        `).get(req.session.userId, today);

        // Active goals
        const activeGoals = db.prepare(`
            SELECT goal_type, COUNT(*) as count, AVG(progress) as avg_progress
            FROM goals WHERE user_id = ? AND status = 'active'
            GROUP BY goal_type
        `).all(req.session.userId);

        // Recent journal entries
        const recentJournals = db.prepare(`
            SELECT COUNT(*) as count
            FROM journal_entries WHERE user_id = ? AND entry_date >= date('now', '-7 days')
        `).get(req.session.userId);

        // Current streak
        const streak = calculateStreak(db, req.session.userId);

        res.json({
            todayTodos,
            overdueTodos: overdueTodos.count,
            activeGoals,
            recentJournals: recentJournals.count,
            streak
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});

// Get activity heatmap data
router.get('/heatmap', (req, res) => {
    const db = req.app.locals.db;
    const { year } = req.query;
    const targetYear = year || new Date().getFullYear();

    try {
        const activities = db.prepare(`
            SELECT activity_date, COUNT(*) as count
            FROM activity_log 
            WHERE user_id = ? AND strftime('%Y', activity_date) = ?
            GROUP BY activity_date
        `).all(req.session.userId, targetYear.toString());

        // Also count completed todos
        const completedTodos = db.prepare(`
            SELECT date(completed_at) as activity_date, COUNT(*) as count
            FROM todos 
            WHERE user_id = ? AND is_completed = 1 AND strftime('%Y', completed_at) = ?
            GROUP BY date(completed_at)
        `).all(req.session.userId, targetYear.toString());

        // Also count journal entries
        const journalEntries = db.prepare(`
            SELECT entry_date as activity_date, COUNT(*) as count
            FROM journal_entries 
            WHERE user_id = ? AND strftime('%Y', entry_date) = ?
            GROUP BY entry_date
        `).all(req.session.userId, targetYear.toString());

        // Merge all activities
        const heatmapData = {};
        
        [...activities, ...completedTodos, ...journalEntries].forEach(item => {
            if (item.activity_date) {
                heatmapData[item.activity_date] = (heatmapData[item.activity_date] || 0) + item.count;
            }
        });

        res.json(heatmapData);
    } catch (error) {
        console.error('Heatmap error:', error);
        res.status(500).json({ error: 'Failed to fetch heatmap data' });
    }
});

// Get todo completion stats
router.get('/todos', (req, res) => {
    const db = req.app.locals.db;
    const { period } = req.query; // 'day', 'week', 'month'

    try {
        let dateFilter;
        let groupBy;

        switch (period) {
            case 'day':
                dateFilter = "date('now', '-30 days')";
                groupBy = 'scheduled_date';
                break;
            case 'week':
                dateFilter = "date('now', '-12 weeks')";
                groupBy = "strftime('%Y-%W', scheduled_date)";
                break;
            case 'month':
            default:
                dateFilter = "date('now', '-12 months')";
                groupBy = "strftime('%Y-%m', scheduled_date)";
        }

        const stats = db.prepare(`
            SELECT 
                ${groupBy} as period,
                COUNT(*) as total,
                SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed
            FROM todos 
            WHERE user_id = ? AND scheduled_date >= ${dateFilter}
            GROUP BY ${groupBy}
            ORDER BY period ASC
        `).all(req.session.userId);

        res.json(stats);
    } catch (error) {
        console.error('Todo stats error:', error);
        res.status(500).json({ error: 'Failed to fetch todo stats' });
    }
});

// Get goal progress over time
router.get('/goals', (req, res) => {
    const db = req.app.locals.db;

    try {
        const shortTermGoals = db.prepare(`
            SELECT id, title, progress, target_date, status, created_at
            FROM goals 
            WHERE user_id = ? AND goal_type = 'short-term'
            ORDER BY created_at DESC
            LIMIT 10
        `).all(req.session.userId);

        const longTermGoals = db.prepare(`
            SELECT id, title, progress, target_date, status, created_at
            FROM goals 
            WHERE user_id = ? AND goal_type = 'long-term'
            ORDER BY created_at DESC
            LIMIT 10
        `).all(req.session.userId);

        // Goal completion rate
        const completionStats = db.prepare(`
            SELECT 
                goal_type,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
            FROM goals WHERE user_id = ?
            GROUP BY goal_type
        `).all(req.session.userId);

        res.json({
            shortTermGoals,
            longTermGoals,
            completionStats
        });
    } catch (error) {
        console.error('Goal stats error:', error);
        res.status(500).json({ error: 'Failed to fetch goal stats' });
    }
});

// Get mood trends
router.get('/mood', (req, res) => {
    const db = req.app.locals.db;
    const { days } = req.query;
    const lookback = days || 30;

    try {
        const moodTrend = db.prepare(`
            SELECT entry_date, mood
            FROM journal_entries 
            WHERE user_id = ? AND mood IS NOT NULL AND entry_date >= date('now', '-${lookback} days')
            ORDER BY entry_date ASC
        `).all(req.session.userId);

        const moodDistribution = db.prepare(`
            SELECT mood, COUNT(*) as count
            FROM journal_entries 
            WHERE user_id = ? AND mood IS NOT NULL
            GROUP BY mood
        `).all(req.session.userId);

        res.json({
            trend: moodTrend,
            distribution: moodDistribution
        });
    } catch (error) {
        console.error('Mood stats error:', error);
        res.status(500).json({ error: 'Failed to fetch mood stats' });
    }
});

// Get streaks info
router.get('/streaks', (req, res) => {
    const db = req.app.locals.db;

    try {
        const currentStreak = calculateStreak(db, req.session.userId);
        const longestStreak = calculateLongestStreak(db, req.session.userId);

        res.json({
            current: currentStreak,
            longest: longestStreak
        });
    } catch (error) {
        console.error('Streaks error:', error);
        res.status(500).json({ error: 'Failed to fetch streaks' });
    }
});

// Alias for streak (singular)
router.get('/streak', (req, res) => {
    const db = req.app.locals.db;

    try {
        const currentStreak = calculateStreak(db, req.session.userId);
        const longestStreak = calculateLongestStreak(db, req.session.userId);

        res.json({
            current: currentStreak,
            longest: longestStreak
        });
    } catch (error) {
        console.error('Streak error:', error);
        res.status(500).json({ error: 'Failed to fetch streak' });
    }
});

// Export data
router.get('/export', (req, res) => {
    const db = req.app.locals.db;

    try {
        const journals = db.prepare(`
            SELECT * FROM journal_entries WHERE user_id = ?
        `).all(req.session.userId);

        const goals = db.prepare(`
            SELECT * FROM goals WHERE user_id = ?
        `).all(req.session.userId);

        const milestones = db.prepare(`
            SELECT gm.* FROM goal_milestones gm
            JOIN goals g ON gm.goal_id = g.id
            WHERE g.user_id = ?
        `).all(req.session.userId);

        const todos = db.prepare(`
            SELECT * FROM todos WHERE user_id = ?
        `).all(req.session.userId);

        const exportData = {
            exportDate: new Date().toISOString(),
            journals,
            goals,
            milestones,
            todos
        };

        res.json(exportData);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// Helper function to calculate current streak
function calculateStreak(db, userId) {
    const today = new Date();
    let streak = 0;
    let currentDate = new Date(today);

    while (true) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Check for any activity on this date
        const activity = db.prepare(`
            SELECT 1 FROM (
                SELECT entry_date as date FROM journal_entries WHERE user_id = ? AND entry_date = ?
                UNION
                SELECT date(completed_at) as date FROM todos WHERE user_id = ? AND is_completed = 1 AND date(completed_at) = ?
                UNION
                SELECT activity_date as date FROM activity_log WHERE user_id = ? AND activity_date = ?
            )
        `).get(userId, dateStr, userId, dateStr, userId, dateStr);

        if (activity) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        } else if (dateStr === today.toISOString().split('T')[0]) {
            // Today might not have activity yet, check yesterday
            currentDate.setDate(currentDate.getDate() - 1);
        } else {
            break;
        }
    }

    return streak;
}

// Helper function to calculate longest streak
function calculateLongestStreak(db, userId) {
    const activities = db.prepare(`
        SELECT DISTINCT date FROM (
            SELECT entry_date as date FROM journal_entries WHERE user_id = ?
            UNION
            SELECT date(completed_at) as date FROM todos WHERE user_id = ? AND is_completed = 1 AND completed_at IS NOT NULL
            UNION
            SELECT activity_date as date FROM activity_log WHERE user_id = ?
        )
        ORDER BY date ASC
    `).all(userId, userId, userId);

    if (activities.length === 0) return 0;

    let longestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < activities.length; i++) {
        const prevDate = new Date(activities[i - 1].date);
        const currDate = new Date(activities[i].date);
        const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            currentStreak++;
            longestStreak = Math.max(longestStreak, currentStreak);
        } else {
            currentStreak = 1;
        }
    }

    return longestStreak;
}

module.exports = router;
