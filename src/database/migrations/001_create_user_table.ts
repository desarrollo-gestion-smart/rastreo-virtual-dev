export const createUserTable = {
    version: 1,
    name: 'CreateUserTable',
    up: `
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER     PRIMARY KEY,
            first_name    TEXT        NOT NULL,
            last_name     TEXT        NOT NULL,
            full_name     TEXT        NOT NULL,
            email         TEXT        NOT NULL      UNIQUE,
            avatar        TEXT,
            api_token     TEXT        NOT NULL,
            last_login    TEXT                      DEFAULT (datetime('now', 'localtime')),
            employees     TEXT,
            permissions   TEXT,
            created_at                DATETIME                          DEFAULT CURRENT_TIMESTAMP,
            updated_at                DATETIME                          DEFAULT CURRENT_TIMESTAMP
        );
    `,
    down: `DROP TABLE IF EXISTS users;`,
};
