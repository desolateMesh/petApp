import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

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
};
