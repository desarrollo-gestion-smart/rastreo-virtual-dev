export const createEmployeeTable = {
    version: 3,
    name: 'CreateEmployeeTable',
    up: `
        CREATE TABLE IF NOT EXISTS employees (
            id                  INTEGER         PRIMARY KEY,
            identification      TEXT            NOT NULL,
            type_id             INTEGER,
            user_id             INTEGER,
            address             TEXT,
            phone               TEXT,
            birthdate           DATE,
            hire_date           DATE,
            department_id       INTEGER,
            department          TEXT,
            emergency_contact   TEXT,
            status              INTEGER                         DEFAULT 1,
            data                TEXT,
            avatar              TEXT,
            active              BOOLEAN                         DEFAULT TRUE,
            company_id          INTEGER           NOT NULL,
            created_at          DATETIME                        DEFAULT CURRENT_TIMESTAMP,
            updated_at          DATETIME                        DEFAULT CURRENT_TIMESTAMP
        );
    `,
    down: `DROP TABLE IF EXISTS employees;`,
};
