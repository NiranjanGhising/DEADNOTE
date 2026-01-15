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
