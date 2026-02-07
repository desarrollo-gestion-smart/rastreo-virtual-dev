export const createCompanyTable = {
    version: 2,
    name: 'CreateCompanyTable',
    up: `
        CREATE TABLE IF NOT EXISTS companies (
            id                        INTEGER     PRIMARY KEY,
            name                      TEXT        NOT NULL,
            description               TEXT,
            logo                      TEXT,
            address                   TEXT,
            phone                     TEXT,
            email                     TEXT,
            website                   TEXT,
            main                      BOOLEAN,
            is_active                 BOOLEAN                       DEFAULT FALSE,
            settings_enables          TEXT,
            parent_id                 INTEGER,
            created_at                DATETIME                          DEFAULT CURRENT_TIMESTAMP,
            updated_at                DATETIME                          DEFAULT CURRENT_TIMESTAMP
        );
    `,
    down: `DROP TABLE IF EXISTS companies;`,
};
