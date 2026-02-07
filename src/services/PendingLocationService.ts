import { databaseService } from '@/database/DatabaseService';
import { OsmanLocationPayload } from '@/services/EjetrackService';

class PendingLocationService {
    private db = databaseService.getDB();

    /**
     * Obtiene todas las ubicaciones pendientes desde la tabla de historial con un límite opcional.
     */
    public async getPendingLocations(limit?: number): Promise<{ id: number; payload: OsmanLocationPayload }[]> {
        try {
            const query = `SELECT id, device_id, latitude, longitude, speed, timestamp, ignition, bearing, altitude, battery, event, power, priority 
                 FROM location_history 
                 WHERE synced = 0 
                 ORDER BY timestamp ASC ${limit ? `LIMIT ${limit}` : ''};`;
            
            // Seleccionamos las columnas necesarias para reconstruir el OsmanLocationPayload
            const rows = await this.db.getAllAsync<any>(query);

            return rows.map(row => ({
                id: row.id,
                payload: {
                    id: row.device_id,
                    lat: row.latitude,
                    lon: row.longitude,
                    speed: row.speed,
                    timestamp: row.timestamp,
                    ignition: row.ignition === 1,
                    bearing: row.bearing,
                    altitude: row.altitude,
                    battery: row.battery,
                    event: row.event,
                    power: row.power,
                    priority: row.priority
                } as OsmanLocationPayload
            }));
        } catch (error) {
            console.error('[PendingLocationService] ❌ Error al obtener ubicaciones pendientes:', error);
            return [];
        }
    }

    /**
     * Marca una ubicación como sincronizada en la tabla de historial.
     */
    public async deletePendingLocation(id: number): Promise<void> {
        try {
            const row = await this.db.getFirstAsync<{ timestamp: number, device_id: string }>(
                'SELECT timestamp, device_id FROM location_history WHERE id = ?;',
                [id]
            );
            
            await this.db.runAsync('UPDATE location_history SET synced = 1 WHERE id = ?;', [id]);
            
            if (row) {
                const { locationHistoryService } = require('./LocationHistoryService');
                await locationHistoryService.updateSyncStatus(row.timestamp, row.device_id, true);
            }
        } catch (error) {
            console.error(`[PendingLocationService] ❌ Error al marcar como sincronizada la ubicación ${id}:`, error);
        }
    }

    /**
     * Obtiene el timestamp del registro pendiente más antiguo.
     */
    public async getOldestCreatedAt(): Promise<Date | null> {
        try {
            const result = await this.db.getFirstAsync<{ created_at: string }>(
                'SELECT created_at FROM location_history WHERE synced = 0 ORDER BY created_at ASC LIMIT 1;'
            );
            return result ? new Date(result.created_at) : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Obtiene la cadena de fecha de creación del registro pendiente más antiguo.
     */
    public async getOldestCreatedAtStr(): Promise<string | null> {
        try {
            const result = await this.db.getFirstAsync<{ created_at: string }>(
                'SELECT created_at FROM location_history WHERE synced = 0 ORDER BY created_at ASC LIMIT 1;'
            );
            return result?.created_at ?? null;
        } catch (error) {
            console.error('[PendingLocationService] ❌ Error al obtener created_at string:', error);
            return null;
        }
    }

    /**
     * Cuenta cuántas ubicaciones pendientes hay en la tabla de historial.
     */
    public async getPendingCount(): Promise<number> {
        try {
            const result = await this.db.getFirstAsync<{ count: number }>(
                'SELECT COUNT(*) as count FROM location_history WHERE synced = 0;'
            );
            return result?.count ?? 0;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Nota: savePendingLocation ya no es necesario aquí porque se guarda vía LocationHistoryService.
     * Se mantiene la firma por compatibilidad temporal si fuera necesario, pero vacía.
     */
    public async savePendingLocation(_payload: OsmanLocationPayload): Promise<void> {
        // Implementación movida a LocationHistoryService.saveLocation(payload, false)
    }

    /**
     * Marca múltiples ubicaciones como sincronizadas en la tabla de historial (Batch Update).
     */
    public async markLocationsAsSynced(ids: number[]): Promise<void> {
        if (ids.length === 0) return;
        try {
            const placeholders = ids.map(() => '?').join(',');
            
            // Obtener datos para el store antes de actualizar
            const rows = await this.db.getAllAsync<{ timestamp: number, device_id: string }>(
                `SELECT timestamp, device_id FROM location_history WHERE id IN (${placeholders});`,
                ids
            );

            // [DB-OPTIM] Actualización masiva eficiente
            await this.db.runAsync(`UPDATE location_history SET synced = 1 WHERE id IN (${placeholders});`, ids);
            console.log(`[DB-OPTIM] ✅ Marcadas como sincronizadas ${ids.length} ubicaciones.`);

            // Notificar al store de forma masiva si es posible, o secuencialmente si no queda otra
            const { useLocationStore } = require('@/store/locationStore');
            const store = useLocationStore.getState();
            
            for (const row of rows) {
                store.updateLocationSyncStatus(row.timestamp, row.device_id, true);
            }
        } catch (error) {
            console.error(`[DB-OPTIM] ❌ Error en actualización masiva de sincronización:`, error);
        }
    }

    /**
     * Marca todas las ubicaciones como sincronizadas (equivalente a vaciar pendientes).
     */
    public async deleteAll(): Promise<void> {
        try {
            await this.db.runAsync('UPDATE location_history SET synced = 1 WHERE synced = 0;');
        } catch (error) {
            console.error('[PendingLocationService] ❌ Error al limpiar pendientes:', error);
        }
    }
}

export const pendingLocationService = new PendingLocationService();
