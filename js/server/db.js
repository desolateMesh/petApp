// db.js
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

export default {
  query: (text, params) => pool.query(text, params),
  // Add a new method for token operations
  createToken: async (userId, sessionId) => {
    const result = await pool.query(
      'INSERT INTO tokens (user_id, session_id, is_used) VALUES ($1, $2, false) RETURNING token',
      [userId, sessionId]
    );
    return result.rows[0].token;
  },
  validateToken: async (token) => {
    const result = await pool.query(
      'SELECT * FROM tokens WHERE token = $1 AND is_used = false',
      [token]
    );
    return result.rows[0];
  },
  invalidateToken: async (token) => {
    await pool.query(
      'UPDATE tokens SET is_used = true WHERE token = $1',
      [token]
    );
  }
};

// Add these functions to your existing db.js file

export async function insertToken(userId, token) {
  const query = 'INSERT INTO tokens (user_id, token, used) VALUES ($1, $2, $3) RETURNING *';
  const values = [userId, token, false];
  return db.query(query, values);
}

export async function validateToken(token) {
  const query = 'SELECT * FROM tokens WHERE token = $1 AND used = FALSE';
  const values = [token];
  return db.query(query, values);
}

export async function markTokenAsUsed(token) {
  const query = 'UPDATE tokens SET used = TRUE WHERE token = $1';
  const values = [token];
  return db.query(query, values);
}