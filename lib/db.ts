import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

let dbInstance: Database.Database | null = null;

const initialize = (db: Database.Database) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_suggestions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      saved_at TEXT DEFAULT CURRENT_TIMESTAMP,
      applied_at TEXT,
      apply_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS dismissed_suggestions (
      id TEXT PRIMARY KEY,
      dismissed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      reason TEXT
    );

    CREATE TABLE IF NOT EXISTS suggestion_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      suggestion_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL,
      action TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      finding_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      fixed_at TEXT,
      dismissed_at TEXT,
      status TEXT DEFAULT 'open'
    );

    CREATE TABLE IF NOT EXISTS setup_snapshots (
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      snapshot_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
};

export const getDb = () => {
  if (!dbInstance) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    dbInstance = new Database(DB_PATH);
    initialize(dbInstance);
  }

  return dbInstance;
};
