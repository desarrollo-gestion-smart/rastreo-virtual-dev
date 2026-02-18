export const createPendingLocationsTable = {
    version: 6,
    name: 'create_pending_locations_table',
    up: `
        -- Tabla eliminada y unificada en location_history
        DROP TABLE IF EXISTS pending_locations;
    `
};
