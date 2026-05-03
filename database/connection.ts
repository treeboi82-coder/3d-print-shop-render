import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database connection configuration
const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || '3dprintshop',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20, // Maximum number of connections in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait when connecting a new client
};

// Create connection pool
const pool = new Pool(poolConfig);

// Database connection class
class Database {
  private pool: Pool;

  constructor() {
    this.pool = pool;
  }

  // Test database connection
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('Database connection successful');
      return true;
    } catch (error) {
      console.error('Database connection failed:', error);
      return false;
    }
  }

  // Execute a query with parameters
  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  // Get a single client from the pool for transactions
  async getClient(): Promise<any> {
    return await this.pool.connect();
  }

  // Close all connections in the pool
  async close(): Promise<void> {
    await this.pool.end();
    console.log('Database connection pool closed');
  }

  // Initialize database schema
  async initializeSchema(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
      const schema = await fs.readFile(schemaPath, 'utf8');
      
      await this.query(schema);
      console.log('Database schema initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database schema:', error);
      throw error;
    }
  }
}

// Create and export database instance
const db = new Database();

export default db;
