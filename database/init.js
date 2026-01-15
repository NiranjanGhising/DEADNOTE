const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'diary.db');
const schemaPath = path.join(__dirname, 'schema.sql');

// Create database
const db = new Database(dbPath);

// Read and execute schema
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

console.log('✅ Database initialized successfully!');
console.log(`📁 Database location: ${dbPath}`);

db.close();
