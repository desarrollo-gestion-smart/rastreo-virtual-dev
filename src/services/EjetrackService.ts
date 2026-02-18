import axios from 'axios';
import { useDeviceStore } from '@/store/deviceStore';
import { EjetrackApi } from '@/api';
import { useServerStore } from '@/store/serverStore';
import { pendingLocationService } from './PendingLocationService';
import { locationHistoryService } from './LocationHistoryService';

export interface OsmanLocationPayload {
    id: string;          // Unique identifier for the tracking device
    ignition: boolean;   // Current ignition status of the vehicle
    lat: number;         // Latitude coordinate in decimal degrees
    lon: number;         // Longitude coordinate in decimal degrees
    timestamp: number;   // Unix timestamp (seconds since epoch)
    speed: number;       // Current speed in km/h
    bearing: number;     // Direction of travel in degrees (0-360)
    altitude: number;    // Altitude above sea level in meters
    battery: number;     // Battery level percentage (0-100)
    event: number;       // Event code indicating the reason for transmission
    power: number;       // External power supply voltage in volts
    priority: number;    // Message priority level
    accuracy?: number;   // GPS accuracy/precision in meters
    hdop?: number;       // Horizontal Dilution of Precision
}

export class EjetrackService {
    private static readonly ENDPOINT = `/ejetrack/v1/devices/send_location`;
    private static readonly BATCH_ENDPOINT = `/ejetrack/v1/devices/send_location`;

    /**
     * Guarda una ubicación en la base de datos local para su posterior envío.
     * OPTIMIZADO: Ahora solo guarda en LocationHistoryService.
     */
    public static async saveLocationOffline(payload: OsmanLocationPayload): Promise<void> {
        console.log(`[EjetrackService] 💾 Guardando ubicación localmente (ID: ${payload.id}, Time: ${payload.timestamp})`);
        // Ya no llamamos a pendingLocationService.savePendingLocation(payload) porque es redundante
        await locationHistoryService.saveLocation(payload, false);
    }

    /**
     * Realiza el envío HTTP de un solo punto de ubicación.
     */
    private static async executeIndividualSend(payload: OsmanLocationPayload): Promise<boolean> {
        try {
            // Verificar si hay token de autenticación
            if (!EjetrackApi.defaults.headers.common['Authorization']) {
                console.warn('[EjetrackService] ⚠️ No hay token de autenticación para envío individual.');
                return false;
            }

            const response = await EjetrackApi.post(this.ENDPOINT, payload, {
                timeout: 5000, // 5 segundos de timeout para envío individual prioritario
            });

            if (response.status === 200 || response.status === 201) {
                return true;
            } else {
                console.warn(`[EjetrackService] ⚠️ Respuesta inesperada: ${response.status}`, response.data);
                return false;
            }
        } catch (error: any) {
            console.error('[EjetrackService] ❌ Error en executeIndividualSend:', error.message);
            return false;
        }
    }

    /**
     * Envía la ubicación actual al servidor Ejetrack usando el protocolo Osman.
     * PRIORIDAD: Intenta enviar el punto actual inmediatamente antes de procesar la cola.
     */
    public static async sendLocation(payload: OsmanLocationPayload, isRetry: boolean = false): Promise<boolean> {
        try {
            if (!isRetry) {
                console.log(`[EjetrackService] ⚡ Intento de envío prioritario (ID: ${payload.id}, Time: ${payload.timestamp})`);
                
                // 1. Intentar envío directo al servidor primero
                const success = await this.executeIndividualSend(payload);

                // 2. Guardar en el historial local 
                // Si tuvo éxito, se guarda como 'synced = 1'. Si falló, como 'synced = 0'.
                await locationHistoryService.saveLocation(payload, success);

                if (success) {
                    console.log(`[EjetrackService] ✅ Punto actual enviado y registrado.`);
                } else {
                    console.warn(`[EjetrackService] ⏳ Falló envío actual prioritario, guardado como pendiente.`);
                }

                // 3. Disparar el proceso de pendientes en segundo plano para limpiar la cola si existe
                this.processPendingLocations();

                return success;
            }

            // Si es un reintento (llamado desde processPendingLocations o flujos antiguos), procedemos con el envío
            console.log(`[EjetrackService] 📡 Reintentando envío (ID: ${payload.id}, Time: ${payload.timestamp})`);
            
            const success = await this.executeIndividualSend(payload);
            if (success) {
                console.log(`[EjetrackService] ✅ Ubicación reintentada con éxito.`);
                await locationHistoryService.updateSyncStatus(payload.timestamp, payload.id, true);
            }
            return success;
        } catch (error: any) {
            console.error('[EjetrackService] ❌ Error enviando ubicación:', error.message);
            // Asegurar persistencia en caso de error no capturado en flujo normal
            if (!isRetry) {
                await locationHistoryService.saveLocation(payload, false);
                this.processPendingLocations();
            }
            return false;
        }
    }

    /**
     * Envía un lote de ubicaciones al servidor.
     */
    public static async sendLocationsBatch(payloads: OsmanLocationPayload[]): Promise<boolean> {
        try {
            const { isServerReachable } = useServerStore.getState();
            if (!isServerReachable) {
                return false;
            }

            // Verificar si hay token de autenticación antes de intentar enviar
            const hasToken = EjetrackApi.defaults.headers.common['Authorization'];
            if (!hasToken) {
                console.warn('[EjetrackService] ⚠️ No hay token de autenticación. Abortando envío de lote.');
                return false;
            }

            console.log(`[EjetrackService] 🚀 Enviando LOTE de ${payloads.length} ubicaciones...`);
            
            // Usamos BATCH_ENDPOINT si está definido y es diferente del ENDPOINT, 
            // o ajustamos el formato del cuerpo según lo que espere el API de lotes.
            const response = await EjetrackApi.post(this.BATCH_ENDPOINT, { locations: payloads }, {
                timeout: 30000, // 30 segundos para lotes grandes
            });

            if (response.status === 200 || response.status === 201) {
                console.log(`[EjetrackService] ✅ Lote enviado con éxito (${payloads.length} puntos)`);
                
                // Actualizar historial para cada punto del lote
                for (const payload of payloads) {
                    await locationHistoryService.updateSyncStatus(payload.timestamp, payload.id, true);
                }
                
                return true;
            } else {
                console.warn(`[EjetrackService] ⚠️ Respuesta inesperada en lote: ${response.status}`);
                return false;
            }
        } catch (error: any) {
            console.error('[EjetrackService] ❌ Error enviando lote:', error.message);
            return false;
        }
    }

    /**
     * Procesa las ubicaciones guardadas localmente de forma secuencial (FIFO) con reintentos y backoff.
     */
    private static isSyncingStatus = false;
    private static syncPromise: Promise<void> | null = null;
    private static lastFailureTime = 0;
    private static retryDelay = 5000; // Iniciar con 5 segundos de espera tras un fallo
    private static lastSyncTimestamp: number | null = null;
    private static activeBatchIds: Set<number> = new Set();

    public static getSyncStatus(): boolean {
        return this.isSyncingStatus;
    }

    public static getLastSyncTimestamp(): number | null {
        return this.lastSyncTimestamp;
    }

    public static isPointInActiveBatch(id: number): boolean {
        return this.activeBatchIds.has(id);
    }

    public static async processPendingLocations(forceAll: boolean = false): Promise<void> {
        if (this.isSyncingStatus && this.syncPromise) {
            console.log('[SYNC-LOCK] 🔒 Sincronización en curso, esperando a la existente...');
            return this.syncPromise;
        }
        
        this.isSyncingStatus = true;
        this.syncPromise = (async () => {
            try {
                // [SYNC-LOCK] Verificar si estamos en un periodo de "enfriamiento" por fallo previo
                const now = Math.floor(Date.now() / 1000);
                const lastFailureUnix = Math.floor(this.lastFailureTime / 1000);
                const retryDelaySeconds = Math.floor(this.retryDelay / 1000);

                if (!forceAll && now - lastFailureUnix < retryDelaySeconds && now >= lastFailureUnix) {
                    console.log(`[SYNC-LOCK] ⏳ Sincronización en espera (Backoff: ${Math.round(retryDelaySeconds - (now - lastFailureUnix))}s)`);
                    this.isSyncingStatus = false;
                    this.syncPromise = null;
                    return;
                }

<<<<<<< HEAD
                const count = await pendingLocationService.getPendingCount();
=======
                let count = await pendingLocationService.getPendingCount();
                
                // Limpieza automática de duplicados si hay muchos paquetes pendientes
                if (count > 200) {
                    try {
                        const deletedCount = await pendingLocationService.cleanDuplicateLocations();
                        if (deletedCount > 0) {
                            console.log(`[EjetrackService] 🧹 Limpieza automática: eliminados ${deletedCount} duplicados.`);
                            // Actualizar el conteo después de la limpieza
                            count = await pendingLocationService.getPendingCount();
                        }
                    } catch (cleanError) {
                        console.error('[EjetrackService] Error en limpieza automática de duplicados:', cleanError);
                    }
                }
                
>>>>>>> bdb814cf1b21d80d6a9bc8e4c1cd252ab2b886c5
                const BATCH_SIZE = 100; // Procesar en bloques de 100 como se solicitó
                const MAX_WAIT_TIME_SEC = 30; // 30 segundos máx. antes de forzar envío de pendientes
                let shouldSend = forceAll;

                if (!shouldSend && count >= BATCH_SIZE) {
                    console.log(`[EjetrackService] 📦 Envío por CANTIDAD disparado (${count} elementos)`);
                    shouldSend = true;
                }

                if (!shouldSend && count > 0) {
                    try {
                        const oldestDate = await pendingLocationService.getOldestCreatedAt();
                        if (oldestDate) {
                            const oldestUnix = Math.floor(oldestDate.getTime() / 1000);
                            const timeElapsed = now - oldestUnix;
                            const remainingTime = MAX_WAIT_TIME_SEC - timeElapsed;

                            // Corrección: Si timeElapsed es negativo, es probable que la hora del dispositivo 
                            // esté mal o haya un desajuste. Disparamos el envío si el registro tiene más de MAX_WAIT_TIME_SEC 
                            // O si el valor es incoherente (negativo extremo) para evitar bloqueos.
                            if (timeElapsed >= MAX_WAIT_TIME_SEC || timeElapsed < -60) {
                                console.log(`[EjetrackService] ⏱️ Envío por TIEMPO disparado. Registro más antiguo hace ${timeElapsed}s`);
                                shouldSend = true;
                            } else {
                                console.log(`[EjetrackService] ⏳ Pendientes: ${count}. El más antiguo tiene ${timeElapsed}s. Faltan ${Math.max(0, remainingTime)}s para envío por tiempo.`);
                            }
                        }
                    } catch (timeCheckError) {
                        console.error('[EjetrackService] Error verificando tiempo de pendientes:', timeCheckError);
                    }
                }

                if (!shouldSend) {
                    this.isSyncingStatus = false;
                    this.syncPromise = null;
                    return;
                }

                // Verificación de conectividad robusta a través del store
                const { isServerReachable } = useServerStore.getState();
                if (!isServerReachable) {
                    if (!forceAll) {
                        return;
                    }
                }

                console.log(`[SYNC-LOCK] 🔄 Sincronizando ubicaciones pendientes (Envío por LOTES)...`);

                let totalSuccessCount = 0;
                let hasMore = true;
                const MAX_TOTAL_BATCHES = 10; // Seguridad para no quedar en un bucle infinito (10 * 100 = 1000 puntos max por ciclo)
                let batchIteration = 0;

                while (hasMore && batchIteration < MAX_TOTAL_BATCHES) {
                    batchIteration++;
                    const pendings = await pendingLocationService.getPendingLocations(BATCH_SIZE);
                    
                    if (pendings.length === 0) {
                        hasMore = false;
                        break;
                    }

                    console.log(`[SYNC-LOCK] 📦 Procesando bloque ${batchIteration} (${pendings.length} puntos)...`);
                    let batchFailed = false;

                    const payloads = pendings.map(item => item.payload);
                    const ids = pendings.map(item => item.id);
                    
                    // Actualizar lote activo para UI
                    ids.forEach(id => this.activeBatchIds.add(id));
                    
                    // Intentamos enviar el lote completo (de hasta 100)
                    const success = await this.sendLocationsBatch(payloads);
                    
                    // Limpiar lote activo
                    ids.forEach(id => this.activeBatchIds.delete(id));

                    if (success) {
                        // [DB-OPTIM] Actualización atómica del lote
                        await pendingLocationService.markLocationsAsSynced(ids);
                        totalSuccessCount += ids.length;
                        
                        this.retryDelay = 5000; // Resetear backoff tras éxito
                        this.lastSyncTimestamp = Math.floor(Date.now() / 1000);

                        // Espera mínima entre bloques para no saturar
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        // Si el bloque actual fue menor que BATCH_SIZE, no hay más por ahora
                        if (pendings.length < BATCH_SIZE) {
                            hasMore = false;
                        }
                    } else {
                        console.log(`[SYNC-LOCK] 🔄 Sincronización por lotes pausada por error.`);
                        
                        // Incrementar backoff exponencialmente (máximo 5 minutos)
                        this.lastFailureTime = Date.now();
                        this.retryDelay = Math.min(this.retryDelay * 2, 300000); 
                        batchFailed = true;
                        hasMore = false;
                    }
                }
                
                if (totalSuccessCount > 0) {
                    console.log(`[SYNC-LOCK] ✨ Sincronización completada. Enviados ${totalSuccessCount} puntos en ${batchIteration} bloques.`);
                }
            } catch (error) {
                console.error('[EjetrackService] ❌ Error en proceso de sincronización por lotes:', error);
            } finally {
                this.isSyncingStatus = false;
                this.syncPromise = null;
            }
        })();

        return this.syncPromise;
    }

    /**
     * Utilidad para mapear los datos de ubicación de Expo al formato Osman.
     */
    public static mapToOsman(
        deviceId: string,
        location: any,
        extraData: {
            ignition?: boolean;
            battery?: number;
            event?: number;
            power?: number;
            priority?: number;
        } = {}
    ): OsmanLocationPayload {
        return {
            id: deviceId,
            ignition: extraData.ignition ?? true, // Por defecto true si está en viaje
            lat: location.coords.latitude,
            lon: location.coords.longitude,
            timestamp: Math.floor(location.timestamp / 1000), // Convertir a segundos (Unix timestamp)
            speed: (location.coords.speed || 0) * 3.6, // Convertir m/s a km/h
            bearing: location.coords.heading || 0,
            altitude: location.coords.altitude || 0,
            battery: extraData.battery ?? 100, // Valor por defecto si no se dispone de él
            event: extraData.event ?? 0,       // Evento genérico
            power: extraData.power ?? 12.0,    // Voltaje por defecto
            priority: extraData.priority ?? 1,
            accuracy: location.coords.accuracy || undefined,
            hdop: location.coords.accuracy ? location.coords.accuracy / 5 : undefined, // Estimación simple
        };
    }
}
