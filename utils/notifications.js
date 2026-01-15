const notifier = require('node-notifier');
const schedule = require('node-schedule');
const path = require('path');
const { getMotivationalQuote } = require('./quotes');

let scheduledJobs = [];

function startNotificationScheduler(db) {
    // Clear existing jobs
    scheduledJobs.forEach(job => job.cancel());
    scheduledJobs = [];

    // Schedule check every 30 minutes during work hours
    const checkJob = schedule.scheduleJob('*/30 9-21 * * *', () => {
        checkAndNotify(db);
    });
    scheduledJobs.push(checkJob);

    // Random motivational quote at random times
    const motivationJob = schedule.scheduleJob('0 10,14,18 * * *', () => {
        sendMotivationalNotification(db);
    });
    scheduledJobs.push(motivationJob);

    console.log('📅 Notification scheduler started');
}

function checkAndNotify(db) {
    try {
        // Get all users with notifications enabled
        const users = db.prepare(`
            SELECT u.id, u.username, ns.pending_threshold, ns.reminder_enabled
            FROM users u
            JOIN notification_settings ns ON u.id = ns.user_id
            WHERE ns.reminder_enabled = 1
        `).all();

        const today = new Date().toISOString().split('T')[0];

        users.forEach(user => {
            // Check pending todos
            const pendingTodos = db.prepare(`
                SELECT COUNT(*) as count FROM todos 
                WHERE user_id = ? AND scheduled_date = ? AND is_completed = 0
            `).get(user.id, today);

            if (pendingTodos.count >= user.pending_threshold) {
                sendNotification(
                    '📋 Tasks Reminder',
                    `You have ${pendingTodos.count} tasks left for today. Keep going!`,
                    'todo-reminder'
                );
            }

            // Check overdue todos
            const overdueTodos = db.prepare(`
                SELECT COUNT(*) as count FROM todos 
                WHERE user_id = ? AND scheduled_date < ? AND is_completed = 0
            `).get(user.id, today);

            if (overdueTodos.count > 0) {
                sendNotification(
                    '⚠️ Overdue Tasks',
                    `You have ${overdueTodos.count} overdue tasks. Consider rescheduling them.`,
                    'overdue-reminder'
                );
            }
        });
    } catch (error) {
        console.error('Notification check error:', error);
    }
}

function sendMotivationalNotification(db) {
    try {
        const users = db.prepare(`
            SELECT u.id FROM users u
            JOIN notification_settings ns ON u.id = ns.user_id
            WHERE ns.motivation_enabled = 1
        `).all();

        if (users.length > 0) {
            const quote = getMotivationalQuote();
            sendNotification(
                '✨ Daily Inspiration',
                `"${quote.text}" - ${quote.author}`,
                'motivation'
            );
        }
    } catch (error) {
        console.error('Motivation notification error:', error);
    }
}

function sendNotification(title, message, type = 'general') {
    notifier.notify({
        title: title,
        message: message,
        icon: path.join(__dirname, '..', 'public', 'icons', 'icon.png'),
        sound: true,
        wait: false,
        appID: 'Personal Growth Diary'
    });
}

// Send a custom notification (can be called from routes)
function sendCustomNotification(title, message) {
    sendNotification(title, message, 'custom');
}

module.exports = {
    startNotificationScheduler,
    sendNotification,
    sendCustomNotification
};
