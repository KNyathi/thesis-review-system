import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbUrl: string = process.env.DB_URL || '';

// Create a connection pool
const pool = new Pool({
  connectionString: dbUrl,
  max: 10, // Maximum number of connections in pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
});

const connectDB = async () => {
  try {
    // Test the connection by getting a client from the pool
    const client = await pool.connect();
    console.log(`PostgreSQL connected successfully`);
    client.release(); // Release the client back to the pool
    
    // Optional: Set up event listeners for pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
      process.exit(-1);
    });
  } catch (error: any) {
    console.error('PostgreSQL connection error:', error.message);
    setTimeout(connectDB, 5000); // Retry connection after 5 seconds
  }
};

export { pool, connectDB };