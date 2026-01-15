// Cleanup test data
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'database', 'diary.db'));

try {
    db.prepare("DELETE FROM todos WHERE title LIKE 'Test%'").run();
    db.prepare("DELETE FROM goals WHERE title LIKE 'Test%'").run();
    db.prepare("DELETE FROM journal_entries WHERE title LIKE 'Test%'").run();
    db.prepare("DELETE FROM users WHERE username = 'testuser'").run();
    console.log('✅ Test data cleaned up successfully');
} catch (error) {
    console.error('Error cleaning up:', error);
} finally {
    db.close();
}
