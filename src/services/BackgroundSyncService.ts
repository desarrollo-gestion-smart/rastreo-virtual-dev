import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { EjetrackService } from '@/services/EjetrackService';
import { useServerStore } from '@/store/serverStore';
import { pendingLocationService } from '@/services/PendingLocationService';
import { LocationTrackingService } from '@/services/LocationTrackingService';

const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_LOCATIONS';

// Definir la tarea de TaskManager
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    const now = new Date();
    console.log(`[BACKGROUND-FETCH] 🕒 Intentando tarea de sincronización: ${now.toLocaleString()}`);

    try {
        // Asegurar que la base de datos esté inicializada (especialmente si es un cold start)
        const { databaseService } = require('@/database/DatabaseService');
        
        // En cold start, es posible que TaskManager se dispare antes que el RootLayout inicialice la DB.
        // Verificamos si la DB está lista, o al menos intentamos obtenerla.
        try {
            const db = databaseService.getDB();
            if (!db) {
                console.warn('[BACKGROUND-FETCH] 🛑 DB no lista aún.');
                return BackgroundFetch.BackgroundFetchResult.NoData;
            }
        } catch (dbError) {
            console.error('[BACKGROUND-FETCH] ❌ Error accediendo a DB:', dbError);
            return BackgroundFetch.BackgroundFetchResult.Failed;
        }

        // 1. Verificar autenticación (usando el estado persistido de Zustand)
        const { useAuthStore } = require('@/store/authStore');
        const { isAuthenticated, isHydrated } = useAuthStore.getState();
        
        if (!isHydrated || !isAuthenticated) {
            console.log('[BACKGROUND-FETCH] 🛑 Saltando: Usuario no autenticado o store no hidratado.');
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        // 2. Verificar si hay una ruta activa (tracking)
        // El requerimiento dice que la tarea debe ejecutarse si NO está iniciada una ruta
        const isTracking = await LocationTrackingService.isTrackingActive();
        if (isTracking) {
            console.log('[BACKGROUND-FETCH] 🛑 Saltando: Seguimiento de ruta activo.');
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        // 3. Verificar si hay puntos pendientes para enviar
        const pendingCount = await pendingLocationService.getPendingCount();
        
        if (pendingCount === 0) {
            // También verificamos si hay logs de estado pendientes
            const { travelStatusLogService } = require('@/services/TravelStatusLogService');
            const pendingLogs = await travelStatusLogService.getByAttributes({ synced: 0 });
            
            if (pendingLogs.length === 0) {
                console.log('[BACKGROUND-FETCH] 🛑 Saltando: No hay puntos ni logs pendientes para enviar.');
                return BackgroundFetch.BackgroundFetchResult.NoData;
            }
        }

        // 4. Verificar conexión a internet a través del store
        const { isServerReachable } = useServerStore.getState();
        if (!isServerReachable) {
            console.log('[BACKGROUND-FETCH] 🛑 Saltando: Servidor no alcanzable.');
            return BackgroundFetch.BackgroundFetchResult.Failed;
        }

        console.log(`[BACKGROUND-FETCH] 🚀 Iniciando sincronización de datos pendientes...`);

        // 5. Ejecutar sincronizaciones
        // Sincronizar logs de estado de viaje
        try {
            const { useTravelStatusLogStore } = require('@/store/travelStatusLogStore');
            const syncStatusLogs = useTravelStatusLogStore.getState().syncPendingLogs;
            await syncStatusLogs();
            console.log('[BACKGROUND-FETCH] ✅ Logs de estado sincronizados.');
        } catch (error) {
            console.error('[BACKGROUND-FETCH] ❌ Error sincronizando logs de estado:', error);
        }

        // Sincronizar ubicaciones pendientes
        // El método processPendingLocations ya maneja su propio bloqueo (SYNC-LOCK)
        await EjetrackService.processPendingLocations(true);
        console.log('[BACKGROUND-FETCH] ✅ Ubicaciones procesadas.');

        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
        console.error('[BACKGROUND-FETCH] ❌ Error crítico en la tarea de fondo:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

export class BackgroundSyncService {
    /**
     * Registra la tarea de sincronización periódica.
     * Se recomienda llamarlo al iniciar la app.
     */
    public static async registerSyncTask() {
        try {
            const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
            if (isRegistered) {
                console.log(`[BACKGROUND-FETCH] La tarea ${BACKGROUND_SYNC_TASK} ya está registrada.`);
            }

            await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
                minimumInterval: 15 * 60, // 15 minutos (mínimo permitido por iOS/Android)
                stopOnTerminate: false,    // Continuar después de cerrar la app
                startOnBoot: true,         // Iniciar al reiniciar el dispositivo
            });
            
            console.log(`[BACKGROUND-FETCH] ✅ Tarea ${BACKGROUND_SYNC_TASK} registrada exitosamente (15 min).`);
        } catch (err) {
            console.error(`[BACKGROUND-FETCH] ❌ Error al registrar la tarea:`, err);
        }
    }

    /**
     * Desregistra la tarea si es necesario.
     */
    public static async unregisterSyncTask() {
        try {
            await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
            console.log(`[BACKGROUND-FETCH] 🛑 Tarea ${BACKGROUND_SYNC_TASK} desregistrada.`);
        } catch (err) {
            console.error(`[BACKGROUND-FETCH] ❌ Error al desregistrar la tarea:`, err);
        }
    }
}
