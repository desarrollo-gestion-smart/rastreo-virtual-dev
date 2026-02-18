import { databaseService } from '@/database/DatabaseService';
import { OsmanLocationPayload } from '@/services/EjetrackService';
import { useLocationStore } from '@/store/locationStore';

export interface LocationHistoryEntry {
    id: number;
    device_id: string;
    latitude: number;
    longitude: number;
    speed: number;
    timestamp: number;
    ignition: boolean;
    synced: boolean;
    created_at: string;
}

class LocationHistoryService {
    private db = databaseService.getDB();

    public async saveLocation(payload: OsmanLocationPayload, synced: boolean): Promise<number | null> {
        try {
            const result = await this.db.runAsync(
                `INSERT INTO location_history (device_id, latitude, longitude, speed, timestamp, ignition, synced, bearing, altitude, battery, event, power, priority) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                [
                    payload.id,
                    payload.lat,
                    payload.lon,
                    payload.speed,
                    Math.floor(payload.timestamp), // [DB-OPTIM] Asegurar INTEGER
                    payload.ignition ? 1 : 0,
                    synced ? 1 : 0,
                    payload.bearing || 0,
                    payload.altitude || 0,
                    payload.battery || 100,
                    payload.event || 0,
                    payload.power || 12,
                    payload.priority || 1
                ]
            );

            // Notificar al store si hay una nueva ubicación
            if (result.lastInsertRowId) {
                const id = Number(result.lastInsertRowId);
                useLocationStore.getState().addLocation({
                    id: id,
                    device_id: payload.id,
                    latitude: payload.lat,
                    longitude: payload.lon,
                    speed: payload.speed,
                    timestamp: payload.timestamp,
                    ignition: payload.ignition,
                    synced: synced,
                    created_at: new Date().toISOString() // Aproximado para el store
                });
                return id;
            }
            return null;
        } catch (error) {
            console.error('[LocationHistoryService] ❌ Error al guardar historial:', error);
            return null;
        }
    }

    public async updateSyncStatus(timestamp: number, deviceId: string, synced: boolean): Promise<void> {
        try {
            await this.db.runAsync(
                'UPDATE location_history SET synced = ? WHERE timestamp = ? AND device_id = ?;',
                [synced ? 1 : 0, timestamp, deviceId]
            );
            
            // Notificar al store el cambio de estado de sincronización
            useLocationStore.getState().updateLocationSyncStatus(timestamp, deviceId, synced);
        } catch (error) {
            console.error('[LocationHistoryService] ❌ Error al actualizar estado de sincronización:', error);
        }
    }

    public async getAllHistory(limit: number = 100): Promise<LocationHistoryEntry[]> {
        try {
            const rows = await this.db.getAllAsync<any>(
                'SELECT * FROM location_history ORDER BY timestamp DESC LIMIT ?;',
                [limit]
            );
            const history = rows.map(row => ({
                ...row,
                ignition: row.ignition === 1,
                synced: row.synced === 1
            }));

            // Actualizar el store con los datos frescos de la DB
            useLocationStore.getState().setLocations(history);

            return history;
        } catch (error) {
            console.error('[LocationHistoryService] ❌ Error al obtener historial:', error);
            return [];
        }
    }

    public async deleteAll(): Promise<void> {
        try {
            await this.db.runAsync('DELETE FROM location_history;');
            useLocationStore.getState().setLocations([]);
        } catch (error) {
            console.error('[LocationHistoryService] ❌ Error al borrar historial:', error);
        }
    }
}

export const locationHistoryService = new LocationHistoryService();
