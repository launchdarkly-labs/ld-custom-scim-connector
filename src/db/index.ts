import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { logger } from '../middleware/logging.js';

let db: Database.Database | null = null;

/**
 * Initialize the SQLite database
 */
export function initDatabase(databasePath: string): Database.Database {
  // Ensure the directory exists
  const dir = path.dirname(databasePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(databasePath);
  
  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alice_id TEXT NOT NULL UNIQUE,
      alice_external_id TEXT,
      ld_id TEXT NOT NULL,
      ld_user_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_user_mappings_alice_id ON user_mappings(alice_id);
    CREATE INDEX IF NOT EXISTS idx_user_mappings_alice_external_id ON user_mappings(alice_external_id);
    CREATE INDEX IF NOT EXISTS idx_user_mappings_ld_id ON user_mappings(ld_id);
  `);

  logger.info({ databasePath }, 'Database initialized');
  return db;
}

/**
 * Get the database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    logger.info('Database connection closed');
  }
}

