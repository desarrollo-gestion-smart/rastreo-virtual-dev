export const createTravelStatusLogsTable = {
    version: 5,
    name: 'createTravelStatusLogsTable',
    up: `
        CREATE TABLE IF NOT EXISTS travel_status_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            status TEXT,
            latitude REAL,
            longitude REAL,
            timestamp TEXT,
            synced INTEGER DEFAULT 0
        );
    `,
    down: `DROP TABLE IF EXISTS travel_status_logs;`,
};
