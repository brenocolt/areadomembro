const fs = require('fs');
const sql = fs.readFileSync('supabase/migrations/001_create_all_tables.sql', 'utf-8');
const createTable = sql.match(/CREATE TABLE IF NOT EXISTS colaboradores \([\s\S]*?\);/);
console.log(createTable[0]);
