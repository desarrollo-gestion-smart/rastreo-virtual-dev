import { BaseService } from '@/database/BaseService';
import { type TravelStatusLog } from '@/models/travel-status-log-model';
import { TripsApi } from '@/api';

const TRAVEL_STATUS_LOG_TABLE = 'travel_status_logs';
const TRAVEL_STATUS_LOG_FIELDS: (keyof TravelStatusLog)[] = [
    'id', 'status', 'latitude', 'longitude', 'timestamp', 'synced'
];

export class TravelStatusLogService extends BaseService<TravelStatusLog> {
    constructor() {
        super(TRAVEL_STATUS_LOG_TABLE, TRAVEL_STATUS_LOG_FIELDS);
    }

    /**
     * Registra un cambio de estado localmente e intenta sincronizarlo.
     */
    public async logStatusChange(status: string, latitude?: number, longitude?: number): Promise<number> {
        try {
            const logData: Partial<TravelStatusLog> = {
                status,
                latitude: latitude || 0,
                longitude: longitude || 0,
                timestamp: new Date().toISOString(),
                synced: 0
            };

            const result = await this.create(logData);
            const localId = result.lastInsertRowId;

            // En este sistema simplificado, podrías elegir no enviar esto a ninguna API de viajes
            // o mapearlo a un servicio diferente. Por ahora, solo lo guardamos localmente.
            console.log(`Estado guardado localmente: ${status}`);

            return localId;
        } catch (error) {
            console.error('Error al registrar cambio de estado localmente:', error);
            throw error;
        }
    }

    /**
     * Sincroniza todos los logs pendientes (Si fuera necesario).
     */
    private isSyncing = false;
    private syncPromise: Promise<number> | null = null;

    public async syncPendingLogs(): Promise<number> {
        if (this.isSyncing && this.syncPromise) {
            console.log('[TravelStatusLogService] 🔒 Sincronización en curso, esperando...');
            return this.syncPromise;
        }

        this.isSyncing = true;
        this.syncPromise = (async () => {
            try {
                // Verificar si hay token de autenticación
                if (!TripsApi.defaults.headers.common['Authorization']) {
                    console.warn('[TravelStatusLogService] ⚠️ No hay token de autenticación. Abortando sincronización de logs.');
                    return 0;
                }

                // Obtener logs pendientes ordenados por timestamp ASC para enviar el más viejo primero
                const query = `SELECT * FROM ${TRAVEL_STATUS_LOG_TABLE} WHERE synced = 0 ORDER BY timestamp ASC;`;
                const pendingLogs = await this.db.getAllAsync<TravelStatusLog>(query);

                if (pendingLogs.length === 0) {
                    return 0;
                }

                console.log(`[TravelStatusLogService] 🔄 Sincronizando ${pendingLogs.length} logs de estado...`);
                let syncedCount = 0;

                for (const log of pendingLogs) {
                    try {
                        // Aquí se enviaría a la API. Como TripsApi está configurado, 
                        // asumimos un endpoint genérico o específico para esto.
                        // Si no hay endpoint definido aún, al menos cumplimos con la lógica de orden.
                        
                        // Ejemplo de envío (ajustar según API real si existe):
                        // await TripsApi.post('/status-logs', log);

                        // Por ahora marcamos como sincronizado localmente
                        await this.update(log.id, { synced: 1 } as Partial<TravelStatusLog>);
                        syncedCount++;
                    } catch (sendError) {
                        console.error(`[TravelStatusLogService] ❌ Error enviando log ${log.id}:`, sendError);
                        // Si falla uno, detenemos la sincronización para mantener el orden en el próximo intento
                        break;
                    }
                }

                return syncedCount;
            } catch (error) {
                console.error('[TravelStatusLogService] ❌ Error en syncPendingLogs:', error);
                return 0;
            } finally {
                this.isSyncing = false;
                this.syncPromise = null;
            }
        })();

        return this.syncPromise;
    }

    public async clearAllLogs(): Promise<void> {
        await this.destroy();
    }
}

export const travelStatusLogService = new TravelStatusLogService();
