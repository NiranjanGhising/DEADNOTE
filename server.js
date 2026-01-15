require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

// Import routes
const authRoutes = require('./routes/auth');
const journalRoutes = require('./routes/journal');
const goalsRoutes = require('./routes/goals');
const todosRoutes = require('./routes/todos');
const statsRoutes = require('./routes/stats');
const notificationRoutes = require('./routes/notifications');
const aiRoutes = require('./routes/ai');

// Import notification scheduler
const { startNotificationScheduler } = require('./utils/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const dbPath = path.join(__dirname, 'database', 'diary.db');
if (!fs.existsSync(dbPath)) {
    console.log('⚠️  Database not found. Run "npm run init-db" first.');
    process.exit(1);
}
const db = new Database(dbPath);

// Make db available to routes
app.locals.db = db;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "blob:"],
        },
    },
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-super-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Auth middleware for API routes
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/journal', requireAuth, journalRoutes);
app.use('/api/goals', requireAuth, goalsRoutes);
app.use('/api/todos', requireAuth, todosRoutes);
app.use('/api/stats', requireAuth, statsRoutes);
app.use('/api/notifications', requireAuth, notificationRoutes);
app.use('/api/ai', requireAuth, aiRoutes);

// Serve pages
app.get('/', (req, res) => {
    if (req.session && req.session.userId) {
        res.redirect('/dashboard');
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

app.get('/dashboard', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/journal', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'journal.html'));
});

app.get('/goals', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'goals.html'));
});

app.get('/todos', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'todos.html'));
});

app.get('/settings', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

// Start notification scheduler
startNotificationScheduler(db);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down gracefully...');
    db.close();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════════╗
    ║                                                   ║
    ║   🌟 Personal Growth Diary                        ║
    ║   ─────────────────────────────                   ║
    ║   Server running at http://localhost:${PORT}         ║
    ║                                                   ║
    ║   📓 Journal your thoughts                        ║
    ║   🎯 Track your goals                             ║
    ║   ✅ Manage your todos                            ║
    ║   📊 Visualize your progress                      ║
    ║                                                   ║
    ╚═══════════════════════════════════════════════════╝
    `);
});
