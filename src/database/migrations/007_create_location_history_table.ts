export const createLocationHistoryTable = {
    version: 7,
    name: 'createLocationHistoryTable',
    up: `
        CREATE TABLE IF NOT EXISTS location_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT,
            latitude REAL,
            longitude REAL,
            speed REAL,
            timestamp INTEGER,
            ignition INTEGER,
            synced INTEGER DEFAULT 0,
            bearing REAL DEFAULT 0,
            altitude REAL DEFAULT 0,
            battery REAL DEFAULT 100,
            event INTEGER DEFAULT 0,
            power REAL DEFAULT 12,
            priority INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_location_history_synced_timestamp ON location_history (synced, timestamp);
    `,
    down: `
        DROP INDEX IF EXISTS idx_location_history_synced_timestamp;
        DROP TABLE IF EXISTS location_history;
    `,
};
