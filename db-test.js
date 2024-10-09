import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function insertTestData() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const insertQuery = `
      INSERT INTO payment_sessions (session_id, isgenerated)
      VALUES ($1, $2)
    `;

    // Insert three test records without user_id
    await client.query(insertQuery, ['test_session_1', false]);
    await client.query(insertQuery, ['test_session_2', true]);
    await client.query(insertQuery, ['test_session_3', false]);

    await client.query('COMMIT');
    console.log('Test data inserted successfully');

    // Verify the inserted data
    const selectQuery = 'SELECT * FROM payment_sessions';
    const result = await client.query(selectQuery);
    console.log('Current data in payment_sessions table:');
    console.table(result.rows);

  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error inserting test data:', e);
  } finally {
    client.release();
  }
}

insertTestData().then(() => {
  pool.end();  // Close the pool when done
});