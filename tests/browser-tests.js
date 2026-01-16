/**
 * Browser-based UI Tests using Puppeteer
 * These tests actually click buttons and verify functionality
 * 
 * Install: npm install puppeteer --save-dev
 * Run: npm run test:browser (or node tests/browser-tests.js)
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3000';
let browser;
let page;
let testResults = [];

// Helper function to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

async function test(name, fn) {
    try {
        await fn();
        testResults.push({ name, passed: true });
        log(`PASS: ${name}`, 'pass');
    } catch (error) {
        testResults.push({ name, passed: false, error: error.message });
        log(`FAIL: ${name} - ${error.message}`, 'fail');
    }
}

// ============== SETUP ==============

async function setup() {
    browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    page.setDefaultTimeout(10000);
}

async function teardown() {
    if (browser) {
        await browser.close();
    }
}

async function login() {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    
    // Check if already on dashboard (already logged in)
    if (page.url().includes('/dashboard')) {
        log('Already logged in', 'info');
        return true;
    }
    
    try {
        // Wait for the login form to be visible
        await page.waitForSelector('#login-form', { timeout: 5000 });
        
        // First try to register a test user (in case it doesn't exist)
        // Click Register tab
        await page.click('.auth-tab[data-tab="register"]');
        await wait(500);
        
        // Wait for register form to be active
        await page.waitForSelector('#register-form.active', { timeout: 2000 }).catch(() => {});
        
        // Fill register form with unique username
        const uniqueUser = 'browsertest' + Date.now();
        await page.type('#register-username', uniqueUser);
        await page.type('#register-password', 'testpass123');
        await page.type('#register-confirm', 'testpass123');
        
        // Submit register form
        await page.click('#register-form button[type="submit"]');
        await wait(2000);
        
        // Check if we're logged in after register
        if (page.url().includes('/dashboard')) {
            log('Registered and logged in successfully', 'info');
            return true;
        }
        
        log('Registration might have failed, trying existing user login...', 'warn');
        
        // If register failed (user exists), try login with known test user
        await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
        await page.waitForSelector('#login-form', { timeout: 5000 });
        
        // Make sure login tab is active
        await page.click('.auth-tab[data-tab="login"]');
        await wait(500);
        
        // Clear fields and fill login form
        const usernameField = await page.$('#login-username');
        const passwordField = await page.$('#login-password');
        
        if (usernameField && passwordField) {
            await usernameField.click({ clickCount: 3 });
            await page.type('#login-username', 'testuser');
            await passwordField.click({ clickCount: 3 });
            await page.type('#login-password', 'testpass123');
            
            // Submit login form
            await page.click('#login-form button[type="submit"]');
            await wait(2000);
        }
        
        // Check if login succeeded
        if (page.url().includes('/dashboard')) {
            log('Logged in successfully', 'info');
            return true;
        }
        
        // Final attempt - register testuser if it doesn't exist
        await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
        await page.click('.auth-tab[data-tab="register"]');
        await wait(500);
        
        await page.type('#register-username', 'testuser');
        await page.type('#register-password', 'testpass123');
        await page.type('#register-confirm', 'testpass123');
        await page.click('#register-form button[type="submit"]');
        await wait(2000);
        
        if (page.url().includes('/dashboard')) {
            log('Created testuser and logged in', 'info');
            return true;
        }
        
        log('Login may have failed, some tests may fail...', 'warn');
        return false;
    } catch (e) {
        log(`Login error: ${e.message}`, 'warn');
        return false;
    }
}

// Helper to safely navigate and wait for selector
async function goToPage(path, waitForSelector) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle0' });
    await wait(500);
    
    // If redirected to login, we're not authenticated
    const currentUrl = page.url();
    if (!currentUrl.includes(path) && (currentUrl.endsWith('/') || currentUrl.includes('/?'))) {
        throw new Error('Not authenticated - redirected to login page');
    }
    
    if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout: 5000 });
    }
}

// ============== BUTTON CLICK TESTS ==============

async function runTests() {
    console.log('\n' + '='.repeat(60));
    console.log('🖱️  BROWSER BUTTON CLICK TESTS (Puppeteer)');
    console.log('='.repeat(60) + '\n');

    await setup();
    
    const loggedIn = await login();
    if (!loggedIn) {
        log('Could not log in, some tests may fail', 'warn');
    }

    // ============== JOURNAL PAGE TESTS ==============
    console.log('\n📋 Journal Page Button Tests');
    console.log('-'.repeat(40));

    await test('Journal: New Entry button opens modal', async () => {
        await goToPage('/journal', '#btn-new-entry');
        
        // Check modal is NOT visible initially
        const modalBefore = await page.$eval('#entry-modal', el => el.classList.contains('active'));
        if (modalBefore) throw new Error('Modal should not be active initially');
        
        // Click New Entry button
        await page.click('#btn-new-entry');
        await wait(400);
        
        // Check modal IS visible now
        const modalAfter = await page.$eval('#entry-modal', el => el.classList.contains('active'));
        if (!modalAfter) throw new Error('Modal should be active after clicking New Entry');
    });

    await test('Journal: Modal X button closes modal', async () => {
        await goToPage('/journal', '#btn-new-entry');
        
        // Open modal
        await page.click('#btn-new-entry');
        await wait(400);
        
        // Verify modal is open
        let isOpen = await page.$eval('#entry-modal', el => el.classList.contains('active'));
        if (!isOpen) throw new Error('Modal should be open');
        
        // Click X button
        await page.click('#entry-modal .modal-close');
        await wait(400);
        
        // Verify modal is closed
        const isClosed = await page.$eval('#entry-modal', el => !el.classList.contains('active'));
        if (!isClosed) throw new Error('Modal should be closed after clicking X button');
    });

    await test('Journal: Cancel button closes modal', async () => {
        await goToPage('/journal', '#btn-new-entry');
        
        // Open modal
        await page.click('#btn-new-entry');
        await wait(400);
        
        // Click Cancel button
        await page.click('#btn-cancel-entry');
        await wait(400);
        
        // Verify modal is closed
        const isClosed = await page.$eval('#entry-modal', el => !el.classList.contains('active'));
        if (!isClosed) throw new Error('Modal should be closed after clicking Cancel');
    });

    await test('Journal: Mood selector buttons work', async () => {
        await goToPage('/journal', '#btn-new-entry');
        await page.click('#btn-new-entry');
        await wait(400);
        
        // Click a mood option
        await page.click('.mood-option[data-mood="good"]');
        await wait(200);
        
        // Verify it's selected
        const isSelected = await page.$eval('.mood-option[data-mood="good"]', el => el.classList.contains('selected'));
        if (!isSelected) throw new Error('Mood option should be selected after clicking');
        
        // Verify hidden input updated
        const moodValue = await page.$eval('#entry-mood', el => el.value);
        if (moodValue !== 'good') throw new Error(`Mood value should be "good", got "${moodValue}"`);
    });

    await test('Journal: Filter controls exist and are interactive', async () => {
        await goToPage('/journal', '#filter-date');
        
        // Check filter elements exist
        const dateFilter = await page.$('#filter-date');
        const moodFilter = await page.$('#filter-mood');
        const searchFilter = await page.$('#filter-search');
        
        if (!dateFilter) throw new Error('Date filter missing');
        if (!moodFilter) throw new Error('Mood filter missing');
        if (!searchFilter) throw new Error('Search filter missing');
        
        // Try interacting with mood filter
        await page.select('#filter-mood', 'good');
        await wait(300);
        const selectedMood = await page.$eval('#filter-mood', el => el.value);
        if (selectedMood !== 'good') throw new Error('Mood filter selection failed');
    });

    // ============== GOALS PAGE TESTS ==============
    console.log('\n📋 Goals Page Button Tests');
    console.log('-'.repeat(40));

    await test('Goals: Short-term goal button opens modal', async () => {
        await goToPage('/goals', '#btn-short-term');
        
        await page.click('#btn-short-term');
        await wait(400);
        
        const isOpen = await page.$eval('#goal-modal', el => el.classList.contains('active'));
        if (!isOpen) throw new Error('Goal modal should open');
        
        // Check it's set to short-term
        const goalType = await page.$eval('#goal-type', el => el.value);
        if (goalType !== 'short-term') throw new Error(`Goal type should be "short-term", got "${goalType}"`);
    });

    await test('Goals: Long-term goal button opens modal', async () => {
        await goToPage('/goals', '#btn-long-term');
        
        await page.click('#btn-long-term');
        await wait(400);
        
        const isOpen = await page.$eval('#goal-modal', el => el.classList.contains('active'));
        if (!isOpen) throw new Error('Goal modal should open');
        
        const goalType = await page.$eval('#goal-type', el => el.value);
        if (goalType !== 'long-term') throw new Error(`Goal type should be "long-term", got "${goalType}"`);
    });

    await test('Goals: Cancel button closes goal modal', async () => {
        await goToPage('/goals', '#btn-short-term');
        
        await page.click('#btn-short-term');
        await wait(400);
        
        await page.click('#btn-cancel-goal');
        await wait(400);
        
        const isClosed = await page.$eval('#goal-modal', el => !el.classList.contains('active'));
        if (!isClosed) throw new Error('Goal modal should close after clicking Cancel');
    });

    await test('Goals: View toggle buttons switch views', async () => {
        await goToPage('/goals', '#btn-calendar-view');
        
        // Click Calendar View
        await page.click('#btn-calendar-view');
        await wait(400);
        
        // Check calendar is visible
        const calendarDisplay = await page.$eval('#calendar-container', el => el.style.display);
        if (calendarDisplay === 'none') throw new Error('Calendar should be visible');
        
        // Check list is hidden
        const listDisplay = await page.$eval('#goals-container', el => el.style.display);
        if (listDisplay !== 'none') throw new Error('Goals list should be hidden');
        
        // Switch back to List View
        await page.click('#btn-list-view');
        await wait(400);
        
        const listDisplayAfter = await page.$eval('#goals-container', el => el.style.display);
        if (listDisplayAfter === 'none') throw new Error('Goals list should be visible after switching back');
    });

    await test('Goals: Filter tabs work', async () => {
        await goToPage('/goals', '.tab[data-filter="short-term"]');
        
        // Click short-term tab
        await page.click('.tab[data-filter="short-term"]');
        await wait(400);
        
        // Check it's active
        const isActive = await page.$eval('.tab[data-filter="short-term"]', el => el.classList.contains('active'));
        if (!isActive) throw new Error('Short-term tab should be active');
        
        // Click All Goals tab
        await page.click('.tab[data-filter=""]');
        await wait(400);
        
        const allActive = await page.$eval('.tab[data-filter=""]', el => el.classList.contains('active'));
        if (!allActive) throw new Error('All Goals tab should be active');
    });

    await test('Goals: Add Milestone button adds input', async () => {
        await goToPage('/goals', '#btn-short-term');
        await page.click('#btn-short-term');
        await wait(400);
        
        // Count initial milestone inputs
        const initialCount = await page.$$eval('.milestone-input', inputs => inputs.length);
        
        // Click Add Milestone
        await page.click('#btn-add-milestone');
        await wait(200);
        
        // Count again
        const newCount = await page.$$eval('.milestone-input', inputs => inputs.length);
        if (newCount !== initialCount + 1) throw new Error(`Expected ${initialCount + 1} milestone inputs, got ${newCount}`);
    });

    await test('Goals: Calendar navigation buttons work', async () => {
        await goToPage('/goals', '#btn-calendar-view');
        await page.click('#btn-calendar-view');
        await wait(400);
        
        // Get current month text
        const initialMonth = await page.$eval('#calendar-month-year', el => el.textContent);
        
        // Click next month
        await page.click('#btn-next-month');
        await wait(400);
        
        const nextMonth = await page.$eval('#calendar-month-year', el => el.textContent);
        if (nextMonth === initialMonth) throw new Error('Month should change after clicking Next');
        
        // Click prev month to go back
        await page.click('#btn-prev-month');
        await wait(400);
        
        const prevMonth = await page.$eval('#calendar-month-year', el => el.textContent);
        if (prevMonth !== initialMonth) throw new Error('Should be back to original month');
    });

    // ============== NAVIGATION TESTS ==============
    console.log('\n📋 Navigation Button Tests');
    console.log('-'.repeat(40));

    await test('Sidebar navigation links work', async () => {
        await goToPage('/dashboard', '.sidebar-nav');
        
        // Click Journal link
        await page.click('a[href="/journal"]');
        await wait(1000);
        if (!page.url().includes('/journal')) throw new Error('Should navigate to journal');
        
        // Click Goals link
        await page.click('a[href="/goals"]');
        await wait(1000);
        if (!page.url().includes('/goals')) throw new Error('Should navigate to goals');
        
        // Click Todos link
        await page.click('a[href="/todos"]');
        await wait(1000);
        if (!page.url().includes('/todos')) throw new Error('Should navigate to todos');
        
        // Click Dashboard link
        await page.click('a[href="/dashboard"]');
        await wait(1000);
        if (!page.url().includes('/dashboard')) throw new Error('Should navigate to dashboard');
    });

    await test('Settings link works', async () => {
        await goToPage('/dashboard', 'a[href="/settings"]');
        
        await page.click('a[href="/settings"]');
        await wait(1000);
        if (!page.url().includes('/settings')) throw new Error('Should navigate to settings');
    });

    await teardown();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 BROWSER TEST SUMMARY');
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
runTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
}).catch(err => {
    console.error('Browser test error:', err.message);
    console.log('\n💡 Make sure to install Puppeteer: npm install puppeteer --save-dev');
    console.log('💡 Also ensure the server is running: npm start\n');
    process.exit(1);
});
