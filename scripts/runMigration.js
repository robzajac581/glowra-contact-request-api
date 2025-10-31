const fs = require('fs');
const path = require('path');
const { getPool, sql } = require('../db');

async function runMigration(migrationFile) {
  let pool;
  
  try {
    console.log(`Reading migration file: ${migrationFile}`);
    const sqlContent = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('Connecting to database...');
    pool = await getPool();
    
    // Split by GO statements (SQL Server batch separator)
    const batches = sqlContent
      .split(/^\s*GO\s*$/mi)
      .map(batch => batch.trim())
      .filter(batch => batch.length > 0);
    
    console.log(`Executing ${batches.length} SQL batch(es)...`);
    
    for (let i = 0; i < batches.length; i++) {
      console.log(`Executing batch ${i + 1}/${batches.length}...`);
      const request = new sql.Request(pool);
      await request.query(batches[i]);
    }
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    // Note: We don't close the pool here as it's a singleton used by the app
    // If you need to close it, uncomment the line below
    // if (pool) await pool.close();
  }
}

// Usage: node scripts/runMigration.js [path-to-sql-file]
const migrationFile = process.argv[2] || path.join(__dirname, '../database/schema.sql');
const fullPath = path.resolve(migrationFile);

if (!fs.existsSync(fullPath)) {
  console.error(`❌ Migration file not found: ${fullPath}`);
  process.exit(1);
}

runMigration(fullPath)
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });

