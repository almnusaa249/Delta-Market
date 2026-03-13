const path = require('path');
require('dotenv').config();

let pool;
let isPostgreSQL = false;
let db; // for sqlite3

if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  isPostgreSQL = true;
} else {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.resolve(__dirname, '../deltamarket.db');
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err);
    } else {
      // Enable foreign key constraints
      db.run('PRAGMA foreign_keys = ON;');
    }
  });
}

// Helper function to run queries
const runQuery = (text, params) => {
  return new Promise((resolve, reject) => {
    if (isPostgreSQL) {
      pool.query(text, params, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    } else {
      // For SQLite, we need to differentiate between SELECT and other queries
      const isSelect = text.trim().toUpperCase().startsWith('SELECT');
      const isInsert = text.trim().toUpperCase().startsWith('INSERT');
      if (isSelect) {
        db.all(text, params, (err, rows) => {
          if (err) reject(err);
          else resolve({ rows });
        });
      } else {
        db.run(text, params, function(err) {
          if (err) {
            console.error('SQLite run error:', err, 'SQL:', text, 'Params:', params);
            reject(err);
          } else {
            // For INSERT, we want to return the lastID; for others, we return an empty rows array
            const lastID = isInsert ? this.lastID : undefined;
            console.log('SQLite insert lastID:', lastID, 'SQL:', text, 'Params:', params);
            resolve({ 
              rows: [], 
              lastID: lastID 
            });
          }
        });
      }
    }
  });
};

// Helper function to get single row
const getRow = (text, params) => {
  return new Promise((resolve, reject) => {
    if (isPostgreSQL) {
      pool.query(text, params, (err, res) => {
        if (err) reject(err);
        else resolve(res.rows[0] || null);
      });
    } else {
      db.get(text, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    }
  });
};

// Helper function to get all rows
const getAllRows = (text, params) => {
  return new Promise((resolve, reject) => {
    if (isPostgreSQL) {
      pool.query(text, params, (err, res) => {
        if (err) reject(err);
        else resolve(res.rows);
      });
    } else {
      db.all(text, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    }
  });
};

// Initialize database - create tables if they don't exist
const initDatabase = () => {
  // Original schema string (PostgreSQL)
  let schemaString = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'trader',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stores (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL,
      store_name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      price REAL NOT NULL,
      stock_quantity INTEGER DEFAULT 0,
      description TEXT,
      image_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sales_invoices (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL,
      client_name TEXT,
      client_phone TEXT,
      total_amount REAL NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id SERIAL PRIMARY KEY,
      store_id INTEGER NOT NULL,
      supplier_name TEXT,
      supplier_phone TEXT,
      total_amount REAL NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sales_transactions (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchase_transactions (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      otp_code TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `;

  // Adjust schema for SQLite if needed
  if (!isPostgreSQL) {
    // Change SERIAL PRIMARY KEY to INTEGER PRIMARY KEY AUTOINCREMENT
    schemaString = schemaString.replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT');
    // Note: SQLite does not enforce the length of TEXT, NUMERIC, etc. but that's fine.
    // Also, we need to ensure that the TIMESTAMP DEFAULT CURRENT_TIMESTAMP works (it does).
  }

  return new Promise((resolve, reject) => {
    if (isPostgreSQL) {
      pool.query(schemaString, (err, res) => {
        if (err) {
          console.error('Error creating tables:', err);
          reject(err);
        } else {
          console.log('Database tables created successfully');
          resolve();
        }
      });
    } else {
      // For SQLite, we can use exec to run multiple statements
      db.exec(schemaString, (err) => {
        if (err) {
          console.error('Error creating tables:', err);
          reject(err);
        } else {
          console.log('Database tables created successfully');
          resolve();
        }
      });
    }
  });
};

module.exports = { pool, initDatabase, runQuery, getRow, getAllRows };
