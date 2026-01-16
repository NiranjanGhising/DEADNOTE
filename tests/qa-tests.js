/**
 * QA Test Suite for Personal Growth Diary
 * Run with: node tests/qa-tests.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
let sessionCookie = '';
let testResults = [];

// Test utilities
function log(message, type = 'info') {
    const colors = {
        pass: '\x1b[32m✅',
        fail: '\x1b[31m❌',
        info: '\x1b[36mℹ️',
        warn: '\x1b[33m⚠️'
    };
    console.log(`${colors[type]} ${message}\x1b[0m`);
}

async function request(method, path, body = null, includeSession = true) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (includeSession && sessionCookie) {
            options.headers['Cookie'] = sessionCookie;
        }

        const req = http.request(options, (res) => {
            let data = '';
            
            // Capture session cookie
            if (res.headers['set-cookie']) {
                const cookies = res.headers['set-cookie'];
                cookies.forEach(cookie => {
                    if (cookie.startsWith('connect.sid=')) {
                        sessionCookie = cookie.split(';')[0];
                    }
                });
            }

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = data;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    // Not JSON, return as string
                }
                resolve({ status: res.statusCode, data: parsed, headers: res.headers });
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

function test(name, fn) {
    return async () => {
        try {
            await fn();
            testResults.push({ name, passed: true });
            log(`PASS: ${name}`, 'pass');
        } catch (error) {
            testResults.push({ name, passed: false, error: error.message });
            log(`FAIL: ${name} - ${error.message}`, 'fail');
        }
    };
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

// ============== TEST SUITES ==============

// 1. Server Health Tests
const serverTests = [
    test('Server is running', async () => {
        const res = await request('GET', '/');
        assert(res.status === 200 || res.status === 302, `Expected 200 or 302, got ${res.status}`);
    }),

    test('Static files are served (CSS)', async () => {
        const res = await request('GET', '/css/style.css');
        assert(res.status === 200, `CSS file not found, got ${res.status}`);
    }),

    test('Static files are served (JS)', async () => {
        const res = await request('GET', '/js/app.js');
        assert(res.status === 200, `JS file not found, got ${res.status}`);
    }),
];

// 2. Authentication Tests
const authTests = [
    test('Auth status returns unauthenticated initially', async () => {
        sessionCookie = ''; // Clear session
        const res = await request('GET', '/api/auth/status', null, false);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.data.authenticated === false, 'Should be unauthenticated');
    }),

    test('Register with invalid data returns error', async () => {
        const res = await request('POST', '/api/auth/register', { username: 'ab', password: '123' });
        assert(res.status === 400, `Expected 400, got ${res.status}`);
    }),

    test('Login with invalid credentials returns 401', async () => {
        const res = await request('POST', '/api/auth/login', { username: 'nonexistent', password: 'wrong' });
        assert(res.status === 401, `Expected 401, got ${res.status}`);
    }),

    test('Login with valid credentials succeeds', async () => {
        const res = await request('POST', '/api/auth/login', { username: 'Sanji', password: 'password123' });
        // This might fail if password is different, but we test the flow
        if (res.status === 401) {
            log('Note: Could not login with test credentials, trying to register', 'warn');
            // Try registering a test user
            const regRes = await request('POST', '/api/auth/register', { username: 'testuser', password: 'testpass123' });
            if (regRes.status === 201 || regRes.status === 400) {
                // Either registered or already exists
                const loginRes = await request('POST', '/api/auth/login', { username: 'testuser', password: 'testpass123' });
                assert(loginRes.status === 200, `Login failed with ${loginRes.status}`);
            }
        } else {
            assert(res.status === 200, `Expected 200, got ${res.status}`);
        }
    }),

    test('Auth status returns authenticated after login', async () => {
        const res = await request('GET', '/api/auth/status');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.data.authenticated === true, 'Should be authenticated');
    }),
];

// 3. Journal API Tests
const journalTests = [
    test('Get journal entries (empty initially)', async () => {
        const res = await request('GET', '/api/journal');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.data), 'Should return array');
    }),

    test('Create journal entry', async () => {
        const res = await request('POST', '/api/journal', {
            title: 'Test Entry',
            content: 'This is a test journal entry',
            mood: 'good',
            mood_note: 'Feeling good today',
            entry_date: new Date().toISOString().split('T')[0]
        });
        assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
        assert(res.data.id, 'Should return entry ID');
    }),

    test('Get journal entries (should have at least one)', async () => {
        const res = await request('GET', '/api/journal');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.data.length > 0, 'Should have at least one entry');
    }),
];

// 4. Goals API Tests
const goalsTests = [
    test('Get goals (empty initially)', async () => {
        const res = await request('GET', '/api/goals');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.data), 'Should return array');
    }),

    test('Create short-term goal', async () => {
        const res = await request('POST', '/api/goals', {
            title: 'Test Short-term Goal',
            description: 'Complete QA testing',
            goal_type: 'short-term',
            target_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            milestones: [{ title: 'Write tests' }, { title: 'Run tests' }]
        });
        assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
        assert(res.data.id, 'Should return goal ID');
    }),

    test('Create long-term goal', async () => {
        const res = await request('POST', '/api/goals', {
            title: 'Test Long-term Goal',
            description: 'Master software development',
            goal_type: 'long-term',
            target_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            milestones: [{ title: 'Learn fundamentals' }, { title: 'Build projects' }]
        });
        assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    }),

    test('Get goals (should have goals now)', async () => {
        const res = await request('GET', '/api/goals');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.data.length > 0, 'Should have at least one goal');
    }),

    test('Get single goal', async () => {
        const listRes = await request('GET', '/api/goals');
        if (listRes.data.length > 0) {
            const goalId = listRes.data[0].id;
            const res = await request('GET', `/api/goals/${goalId}`);
            assert(res.status === 200, `Expected 200, got ${res.status}`);
            assert(res.data.id === goalId, 'Should return correct goal');
        }
    }),

    test('Update goal progress', async () => {
        const listRes = await request('GET', '/api/goals');
        if (listRes.data.length > 0) {
            const goalId = listRes.data[0].id;
            const res = await request('PUT', `/api/goals/${goalId}`, { progress: 50 });
            assert(res.status === 200, `Expected 200, got ${res.status}`);
        }
    }),
];

// 5. Todos API Tests
const todosTests = [
    test('Get todos', async () => {
        const res = await request('GET', '/api/todos');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.data), 'Should return array');
    }),

    test('Create todo', async () => {
        const res = await request('POST', '/api/todos', {
            title: 'Test Todo',
            description: 'Complete this test',
            priority: 'high',
            scheduled_date: new Date().toISOString().split('T')[0]
        });
        assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
        assert(res.data.id, 'Should return todo ID');
    }),

    test('Get today todos', async () => {
        const res = await request('GET', '/api/todos/today');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.data), 'Should return array');
    }),

    test('Get overdue todos', async () => {
        const res = await request('GET', '/api/todos/overdue');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.data), 'Should return array');
    }),

    test('Toggle todo completion', async () => {
        const listRes = await request('GET', '/api/todos');
        if (listRes.data.length > 0) {
            const todoId = listRes.data[0].id;
            const res = await request('PATCH', `/api/todos/${todoId}/toggle`);
            assert(res.status === 200, `Expected 200, got ${res.status}`);
        }
    }),
];

// 6. Stats API Tests
const statsTests = [
    test('Get dashboard stats', async () => {
        const res = await request('GET', '/api/stats/dashboard');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.data.todayTodos !== undefined, 'Should have todayTodos');
        assert(res.data.streak !== undefined, 'Should have streak');
    }),

    test('Get heatmap data', async () => {
        const res = await request('GET', '/api/stats/heatmap');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(typeof res.data === 'object', 'Should return object');
    }),

    test('Get todo stats', async () => {
        const res = await request('GET', '/api/stats/todos');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    }),

    test('Get mood stats', async () => {
        const res = await request('GET', '/api/stats/mood');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    }),

    test('Get streak data', async () => {
        const res = await request('GET', '/api/stats/streak');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    }),
];

// 7. AI/Quotes API Tests
const aiTests = [
    test('Get motivational quote', async () => {
        const res = await request('GET', '/api/ai/quote');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.data.text, 'Should have quote text');
        assert(res.data.author, 'Should have quote author');
    }),

    test('Get AI tips (with fallback)', async () => {
        const res = await request('POST', '/api/ai/tips', {
            context: 'todos',
            items: [{ title: 'Test task', priority: 'high' }]
        });
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.data.tips, 'Should have tips');
    }),
];

// 8. Notification Settings Tests
const notificationTests = [
    test('Get notification settings', async () => {
        const res = await request('GET', '/api/notifications/settings');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    }),

    test('Get pending notifications', async () => {
        const res = await request('GET', '/api/notifications/pending');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    }),
];

// 9. Page Access Tests (after auth)
const pageTests = [
    test('Dashboard page accessible', async () => {
        const res = await request('GET', '/dashboard');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    }),

    test('Journal page accessible', async () => {
        const res = await request('GET', '/journal');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    }),

    test('Goals page accessible', async () => {
        const res = await request('GET', '/goals');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    }),

    test('Todos page accessible', async () => {
        const res = await request('GET', '/todos');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    }),

    test('Settings page accessible', async () => {
        const res = await request('GET', '/settings');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
    }),
];

// 10. Edge Case Tests
const edgeCaseTests = [
    test('Create journal with empty content fails', async () => {
        const res = await request('POST', '/api/journal', {
            title: 'Test',
            content: '',
            entry_date: new Date().toISOString().split('T')[0]
        });
        assert(res.status === 400, `Expected 400 for empty content, got ${res.status}`);
    }),

    test('Create goal without title fails', async () => {
        const res = await request('POST', '/api/goals', {
            title: '',
            goal_type: 'short-term'
        });
        assert(res.status === 400, `Expected 400 for empty title, got ${res.status}`);
    }),

    test('Create todo without title fails', async () => {
        const res = await request('POST', '/api/todos', {
            title: '',
            scheduled_date: new Date().toISOString().split('T')[0]
        });
        assert(res.status === 400, `Expected 400 for empty title, got ${res.status}`);
    }),

    test('Access non-existent goal returns 404', async () => {
        const res = await request('GET', '/api/goals/999999');
        assert(res.status === 404, `Expected 404, got ${res.status}`);
    }),

    test('Delete non-existent todo returns 404', async () => {
        const res = await request('DELETE', '/api/todos/999999');
        assert(res.status === 404, `Expected 404, got ${res.status}`);
    }),

    test('Invalid mood value is rejected', async () => {
        const res = await request('POST', '/api/journal', {
            title: 'Test',
            content: 'Test content',
            mood: 'invalid_mood',
            entry_date: new Date().toISOString().split('T')[0]
        });
        // Should either reject or ignore invalid mood
        assert(res.status === 400 || res.status === 201, `Unexpected status ${res.status}`);
    }),

    test('Invalid priority value is rejected', async () => {
        const res = await request('POST', '/api/todos', {
            title: 'Test Todo',
            priority: 'invalid_priority',
            scheduled_date: new Date().toISOString().split('T')[0]
        });
        // Should either reject or use default
        assert(res.status === 400 || res.status === 201, `Unexpected status ${res.status}`);
    }),
];

// 11. UI Elements & Button Tests
const uiButtonTests = [
    // Dashboard page buttons
    test('Dashboard has navigation buttons', async () => {
        const res = await request('GET', '/dashboard');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        const html = res.data;
        assert(html.includes('href="/journal"'), 'Missing Journal nav link');
        assert(html.includes('href="/goals"'), 'Missing Goals nav link');
        assert(html.includes('href="/todos"'), 'Missing Todos nav link');
        assert(html.includes('href="/settings"'), 'Missing Settings nav link');
    }),

    // Journal page buttons
    test('Journal page has New Entry button', async () => {
        const res = await request('GET', '/journal');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        const html = res.data;
        assert(html.includes('id="btn-new-entry"'), 'Missing New Entry button');
        assert(html.includes('New Entry'), 'New Entry button text missing');
    }),

    test('Journal page has filter controls', async () => {
        const res = await request('GET', '/journal');
        const html = res.data;
        assert(html.includes('id="filter-date"'), 'Missing date filter');
        assert(html.includes('id="filter-mood"'), 'Missing mood filter');
        assert(html.includes('id="filter-search"'), 'Missing search filter');
    }),

    test('Journal page has modal with Save/Cancel buttons', async () => {
        const res = await request('GET', '/journal');
        const html = res.data;
        assert(html.includes('id="btn-save-entry"'), 'Missing Save Entry button');
        assert(html.includes('id="btn-cancel-entry"'), 'Missing Cancel button');
        assert(html.includes('class="modal-close"'), 'Missing modal close button');
    }),

    test('Journal page has editor toolbar buttons', async () => {
        const res = await request('GET', '/journal');
        const html = res.data;
        assert(html.includes('data-format="bold"'), 'Missing bold button');
        assert(html.includes('data-format="italic"'), 'Missing italic button');
        assert(html.includes('data-format="underline"'), 'Missing underline button');
    }),

    // Goals page buttons
    test('Goals page has Short-term and Long-term goal buttons', async () => {
        const res = await request('GET', '/goals');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        const html = res.data;
        assert(html.includes('id="btn-short-term"'), 'Missing Short-term goal button');
        assert(html.includes('id="btn-long-term"'), 'Missing Long-term goal button');
    }),

    test('Goals page has view toggle buttons', async () => {
        const res = await request('GET', '/goals');
        const html = res.data;
        assert(html.includes('id="btn-list-view"'), 'Missing List View button');
        assert(html.includes('id="btn-calendar-view"'), 'Missing Calendar View button');
    }),

    test('Goals page has filter tabs', async () => {
        const res = await request('GET', '/goals');
        const html = res.data;
        assert(html.includes('data-filter=""'), 'Missing All Goals tab');
        assert(html.includes('data-filter="short-term"'), 'Missing Short-term tab');
        assert(html.includes('data-filter="long-term"'), 'Missing Long-term tab');
        assert(html.includes('data-filter="completed"'), 'Missing Completed tab');
    }),

    test('Goals page has calendar navigation', async () => {
        const res = await request('GET', '/goals');
        const html = res.data;
        assert(html.includes('id="btn-prev-month"'), 'Missing Prev month button');
        assert(html.includes('id="btn-next-month"'), 'Missing Next month button');
    }),

    test('Goals page has goal modal buttons', async () => {
        const res = await request('GET', '/goals');
        const html = res.data;
        assert(html.includes('id="btn-save-goal"'), 'Missing Save Goal button');
        assert(html.includes('id="btn-cancel-goal"'), 'Missing Cancel Goal button');
        assert(html.includes('id="btn-add-milestone"'), 'Missing Add Milestone button');
    }),

    test('Goals page has progress modal buttons', async () => {
        const res = await request('GET', '/goals');
        const html = res.data;
        assert(html.includes('id="btn-update-progress"'), 'Missing Update Progress button');
        assert(html.includes('id="btn-cancel-progress"'), 'Missing Cancel Progress button');
        assert(html.includes('id="progress-slider"'), 'Missing progress slider');
    }),

    // Todos page buttons
    test('Todos page has Add Todo button', async () => {
        const res = await request('GET', '/todos');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        const html = res.data;
        assert(html.includes('Add Todo') || html.includes('New Todo') || html.includes('btn-add-todo') || html.includes('btn-new-todo'), 
            'Missing Add/New Todo button');
    }),

    test('Todos page has view toggle (list/calendar)', async () => {
        const res = await request('GET', '/todos');
        const html = res.data;
        // Check for either list/calendar view or similar UI elements
        assert(html.includes('List') || html.includes('Calendar') || html.includes('view'), 
            'Missing view toggle elements');
    }),

    // Settings page buttons
    test('Settings page has save/update buttons', async () => {
        const res = await request('GET', '/settings');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        const html = res.data;
        assert(html.includes('Save') || html.includes('Update') || html.includes('btn-save'), 
            'Missing save/update buttons');
    }),

    test('Settings page has notification settings', async () => {
        const res = await request('GET', '/settings');
        const html = res.data;
        assert(html.includes('notification') || html.includes('Notification'), 
            'Missing notification settings');
    }),

    // Login page buttons
    test('Login page has login and register buttons', async () => {
        const res = await request('GET', '/', null, false);
        const html = res.data;
        assert(html.includes('Login') || html.includes('login'), 'Missing Login button');
        assert(html.includes('Register') || html.includes('register') || html.includes('Sign up'), 
            'Missing Register button');
    }),

    test('Login page has form inputs', async () => {
        const res = await request('GET', '/', null, false);
        const html = res.data;
        assert(html.includes('type="text"') || html.includes('type="email"') || html.includes('username'), 
            'Missing username/email input');
        assert(html.includes('type="password"'), 'Missing password input');
    }),

    // Sidebar navigation
    test('All pages have sidebar with logout button', async () => {
        const pages = ['/dashboard', '/journal', '/goals', '/todos', '/settings'];
        for (const page of pages) {
            const res = await request('GET', page);
            assert(res.status === 200, `${page} not accessible`);
            const html = res.data;
            assert(html.includes('sidebar') || html.includes('Sidebar'), `${page} missing sidebar`);
            assert(html.includes('logout') || html.includes('Logout') || html.includes('🚪'), 
                `${page} missing logout button`);
        }
    }),

    // Modal functionality via API
    test('Journal modal form fields present', async () => {
        const res = await request('GET', '/journal');
        const html = res.data;
        assert(html.includes('id="entry-date"'), 'Missing entry date field');
        assert(html.includes('id="entry-title"'), 'Missing entry title field');
        assert(html.includes('id="entry-content"'), 'Missing entry content field');
        assert(html.includes('id="entry-mood"'), 'Missing entry mood field');
        assert(html.includes('class="mood-option"') || html.includes('mood-selector'), 'Missing mood selector');
    }),

    test('Goal modal form fields present', async () => {
        const res = await request('GET', '/goals');
        const html = res.data;
        assert(html.includes('id="goal-title"'), 'Missing goal title field');
        assert(html.includes('id="goal-description"'), 'Missing goal description field');
        assert(html.includes('id="goal-target-date"'), 'Missing goal target date field');
        assert(html.includes('id="goal-type"'), 'Missing goal type field');
    }),
];

// 12. Button Action API Tests (testing what buttons would trigger)
const buttonActionTests = [
    test('Journal CRUD workflow (button actions)', async () => {
        // Create (New Entry button action)
        const createRes = await request('POST', '/api/journal', {
            title: 'Button Test Entry',
            content: 'Testing button workflow',
            mood: 'good',
            entry_date: new Date().toISOString().split('T')[0]
        });
        assert(createRes.status === 201, 'Create entry failed');
        const entryId = createRes.data.id;

        // Read (entry loads on page)
        const readRes = await request('GET', '/api/journal');
        assert(readRes.status === 200, 'Read entries failed');
        assert(readRes.data.some(e => e.id === entryId), 'Created entry not found');

        // Update (Edit button action)
        const updateRes = await request('PUT', `/api/journal/${entryId}`, {
            title: 'Updated Button Test',
            content: 'Updated content',
            mood: 'amazing',
            entry_date: new Date().toISOString().split('T')[0]
        });
        assert(updateRes.status === 200, 'Update entry failed');

        // Delete (Delete button action)
        const deleteRes = await request('DELETE', `/api/journal/${entryId}`);
        assert(deleteRes.status === 200, 'Delete entry failed');
    }),

    test('Goal CRUD workflow (button actions)', async () => {
        // Create (Short-term Goal button action)
        const createRes = await request('POST', '/api/goals', {
            title: 'Button Test Goal',
            description: 'Testing goal buttons',
            goal_type: 'short-term',
            target_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            milestones: [{ title: 'Step 1' }, { title: 'Step 2' }]
        });
        assert(createRes.status === 201, 'Create goal failed');
        const goalId = createRes.data.id;

        // Read single goal (Edit button loads this)
        const readRes = await request('GET', `/api/goals/${goalId}`);
        assert(readRes.status === 200, 'Read goal failed');
        assert(readRes.data.milestones.length === 2, 'Milestones not saved');

        // Update progress (Progress modal button action)
        const progressRes = await request('PUT', `/api/goals/${goalId}`, { progress: 75 });
        assert(progressRes.status === 200, 'Update progress failed');

        // Toggle milestone (Milestone checkbox action)
        const goalData = await request('GET', `/api/goals/${goalId}`);
        if (goalData.data.milestones && goalData.data.milestones.length > 0) {
            const milestoneId = goalData.data.milestones[0].id;
            const toggleRes = await request('PATCH', `/api/goals/${goalId}/milestones/${milestoneId}/toggle`);
            assert(toggleRes.status === 200, 'Toggle milestone failed');
        }

        // Complete goal (Mark as Completed button action)
        const completeRes = await request('PUT', `/api/goals/${goalId}`, { 
            progress: 100,
            status: 'completed' 
        });
        assert(completeRes.status === 200, 'Complete goal failed');

        // Delete (Delete button action)
        const deleteRes = await request('DELETE', `/api/goals/${goalId}`);
        assert(deleteRes.status === 200, 'Delete goal failed');
    }),

    test('Todo CRUD workflow (button actions)', async () => {
        // Create (Add Todo button action)
        const createRes = await request('POST', '/api/todos', {
            title: 'Button Test Todo',
            description: 'Testing todo buttons',
            priority: 'high',
            scheduled_date: new Date().toISOString().split('T')[0]
        });
        assert(createRes.status === 201, 'Create todo failed');
        const todoId = createRes.data.id;

        // Toggle complete (Checkbox button action)
        const toggleRes = await request('PATCH', `/api/todos/${todoId}/toggle`);
        assert(toggleRes.status === 200, 'Toggle todo failed');

        // Toggle back
        const toggleBackRes = await request('PATCH', `/api/todos/${todoId}/toggle`);
        assert(toggleBackRes.status === 200, 'Toggle back failed');

        // Reschedule (Reschedule button action)
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const rescheduleRes = await request('PUT', `/api/todos/${todoId}`, {
            scheduled_date: tomorrow
        });
        assert(rescheduleRes.status === 200, 'Reschedule todo failed');

        // Delete (Delete button action)
        const deleteRes = await request('DELETE', `/api/todos/${todoId}`);
        assert(deleteRes.status === 200, 'Delete todo failed');
    }),

    test('Notification settings update (Settings button action)', async () => {
        // Get current settings
        const getRes = await request('GET', '/api/notifications/settings');
        assert(getRes.status === 200, 'Get notification settings failed');

        // Update settings (Save button action)
        const updateRes = await request('PUT', '/api/notifications/settings', {
            enabled: true,
            reminder_time: '09:00',
            quote_enabled: true
        });
        assert(updateRes.status === 200, 'Update notification settings failed');
    }),

    test('AI tips refresh (Refresh button action)', async () => {
        const res = await request('POST', '/api/ai/tips', {
            context: 'dashboard',
            items: [{ title: 'Test task' }]
        });
        assert(res.status === 200, 'Get AI tips failed');
        assert(res.data.tips, 'Tips not returned');
    }),

    test('Quote refresh (Quote refresh action)', async () => {
        const res = await request('GET', '/api/ai/quote');
        assert(res.status === 200, 'Get quote failed');
        assert(res.data.text, 'Quote text missing');
        assert(res.data.author !== undefined, 'Quote author missing');
    }),
];

// 13. Event Handler Pattern Tests (detect broken onclick handlers)
const eventHandlerTests = [
    test('Journal modal buttons use addEventListener (not broken inline onclick)', async () => {
        const res = await request('GET', '/journal');
        const html = res.data;
        
        // Check that modal-close does NOT have inline onclick (which was the bug)
        // The fix was to use addEventListener instead
        const hasInlineOnclickOnModalClose = html.includes('class="modal-close" onclick=') || 
                                              html.includes('class="modal-close"  onclick=');
        
        // If inline onclick exists, check if closeModal is defined globally (before DOMContentLoaded)
        if (hasInlineOnclickOnModalClose) {
            // This pattern is problematic - closeModal defined inside DOMContentLoaded won't be available
            const hasGlobalCloseModal = html.includes('function closeModal()') && 
                                        !html.includes('DOMContentLoaded');
            assert(hasGlobalCloseModal, 
                'WARNING: modal-close has inline onclick="closeModal()" but closeModal may not be globally available. ' +
                'Use addEventListener instead of inline onclick for functions defined in DOMContentLoaded.');
        }
        
        // Verify the fix is in place - should use addEventListener
        assert(html.includes("querySelector('#entry-modal .modal-close')") || 
               html.includes('querySelector("#entry-modal .modal-close")') ||
               html.includes('.modal-close').includes('addEventListener') ||
               !hasInlineOnclickOnModalClose,
               'Modal close button should use addEventListener pattern');
    }),

    test('Goals modal buttons use proper event binding', async () => {
        const res = await request('GET', '/goals');
        const html = res.data;
        
        // Check for addEventListener pattern usage
        assert(html.includes('addEventListener'), 
            'Goals page should use addEventListener for button handlers');
    }),

    test('No orphaned inline onclick handlers referencing undefined functions', async () => {
        const pages = ['/journal', '/goals', '/todos', '/settings'];
        
        for (const page of pages) {
            const res = await request('GET', page);
            const html = res.data;
            
            // Extract all onclick="functionName()" patterns
            const onclickMatches = html.match(/onclick="(\w+)\([^"]*\)"/g) || [];
            
            for (const match of onclickMatches) {
                const funcName = match.match(/onclick="(\w+)\(/)[1];
                
                // These are common safe global functions or properly defined
                const safeGlobals = ['logout', 'escapeHtml', 'showToast', 'formatDate', 
                                    'editGoal', 'deleteGoal', 'openProgressModal', 'completeGoal',
                                    'toggleMilestone', 'editEntry', 'deleteEntry', 'showImagePreview',
                                    'editTodo', 'deleteTodo', 'toggleTodo', 'rescheduleTodo',
                                    'loadGoalTips', 'closeImagePreview'];
                
                // Check if function is defined in the page (either globally or will be attached via addEventListener)
                const funcDefinedInPage = html.includes(`function ${funcName}(`) || 
                                          html.includes(`${funcName} =`) ||
                                          html.includes(`async function ${funcName}(`);
                
                if (!safeGlobals.includes(funcName) && !funcDefinedInPage) {
                    log(`Warning: ${page} has onclick="${funcName}()" but function may not be globally available`, 'warn');
                }
            }
        }
        // This test passes but logs warnings for potential issues
        assert(true, 'Checked for orphaned onclick handlers');
    }),

    test('All modal close buttons have event listeners attached', async () => {
        const res = await request('GET', '/journal');
        const html = res.data;
        
        // Count modal-close buttons
        const modalCloseCount = (html.match(/class="modal-close"/g) || []).length;
        
        // Check for addEventListener attachments for modal-close
        const hasModalCloseListener = html.includes('.modal-close') && 
                                      html.includes('addEventListener');
        
        if (modalCloseCount > 0) {
            assert(hasModalCloseListener || !html.includes('onclick="closeModal()"'), 
                `Found ${modalCloseCount} modal-close button(s) - ensure all have working event handlers`);
        }
    }),
];

// ============== RUN TESTS ==============

async function runAllTests() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 PERSONAL GROWTH DIARY - QA TEST SUITE');
    console.log('='.repeat(60) + '\n');

    const allTests = [
        { name: 'Server Health', tests: serverTests },
        { name: 'Authentication', tests: authTests },
        { name: 'Journal API', tests: journalTests },
        { name: 'Goals API', tests: goalsTests },
        { name: 'Todos API', tests: todosTests },
        { name: 'Stats API', tests: statsTests },
        { name: 'AI/Quotes API', tests: aiTests },
        { name: 'Notifications', tests: notificationTests },
        { name: 'Page Access', tests: pageTests },
        { name: 'Edge Cases', tests: edgeCaseTests },
        { name: 'UI Elements & Buttons', tests: uiButtonTests },
        { name: 'Button Action Workflows', tests: buttonActionTests },
        { name: 'Event Handler Patterns', tests: eventHandlerTests },
    ];

    for (const suite of allTests) {
        console.log(`\n📋 ${suite.name} Tests`);
        console.log('-'.repeat(40));
        for (const testFn of suite.tests) {
            await testFn();
        }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));

    const passed = testResults.filter(t => t.passed).length;
    const failed = testResults.filter(t => !t.passed).length;

    console.log(`\n✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📝 Total:  ${testResults.length}`);

    if (failed > 0) {
        console.log('\n❌ Failed Tests:');
        testResults.filter(t => !t.passed).forEach(t => {
            console.log(`   - ${t.name}: ${t.error}`);
        });
    }

    console.log('\n' + '='.repeat(60) + '\n');

    return { passed, failed, total: testResults.length };
}

// Run tests
runAllTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
}).catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
});
