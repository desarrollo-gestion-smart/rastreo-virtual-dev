import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { ALL_MIGRATIONS } from './migrations';

const DB_NAME = 'rastreo_virtual.db';

class DatabaseService {
    private db: SQLiteDatabase;

    constructor() {
        this.db = openDatabaseSync(DB_NAME);
    }

    /**
     * Devuelve la instancia de la base de datos para que otros servicios la usen.
     */
    public getDB(): SQLiteDatabase {
        return this.db;
    }

    /**
     * Inicializa la base de datos y ejecuta las migraciones pendientes.
     */
    public init = async (): Promise<void> => {
        try {
            await this.db.withTransactionAsync(async () => {
                await this.db.runAsync(`CREATE TABLE IF NOT EXISTS db_version (version INTEGER NOT NULL);`);
                await this.db.runAsync(`INSERT INTO db_version (version) SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM db_version);`);

                const result = await this.db.getFirstAsync<{ version: number }>('SELECT version FROM db_version;');
                const currentVersion = result?.version ?? 0;
                console.log(`Versión actual de la DB: ${currentVersion}`);

                const migrationsToRun = ALL_MIGRATIONS
                    .filter(m => m.version > currentVersion)
                    .sort((a, b) => a.version - b.version);

                if (migrationsToRun.length > 0) {
                    console.log(`🚀 Se encontraron ${migrationsToRun.length} migraciones pendientes.`);
                    for (const migration of migrationsToRun) {
                        console.log(`Ejecutando migración v${migration.version}: ${migration.name}`);
                        await this.db.runAsync(migration.up);
                        await this.db.runAsync('UPDATE db_version SET version = ?;', migration.version);
                    }
                } else {
                    console.log('✅ Base de datos ya está actualizada.');
                }
            });
            console.log("✅ Proceso de migración finalizado con éxito.");
        } catch (error) {
            console.error("❌ Error en la transacción de migración:", error);
            throw error;
        }
    };
}

export const databaseService = new DatabaseService();
