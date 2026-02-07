export const createDevicesTable = {
    version: 4,
    name: 'CreateDevicesTable',
    up: `
        CREATE TABLE IF NOT EXISTS devices (
            id                        INTEGER           PRIMARY KEY,
            name                      TEXT              NOT NULL,
            device_id                 TEXT,
            data                      TEXT,
            image_link                TEXT,
            options                   TEXT,
            company_id                INTEGER           NOT NULL,
            active                    BOOLEAN                           DEFAULT FALSE,
            created_at                DATETIME                          DEFAULT CURRENT_TIMESTAMP,
            updated_at                DATETIME                          DEFAULT CURRENT_TIMESTAMP
        );
    `,
    down: `DROP TABLE IF EXISTS devices;`,
};
