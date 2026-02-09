import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as TaskManager from 'expo-task-manager';
import * as KeepAwake from 'expo-keep-awake';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility, AndroidStyle } from '@notifee/react-native';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTripStore } from '@/store/tripStore';
import { getDistance } from '@/utils/geoUtils';
import { EjetrackService } from './EjetrackService';
import { EjetrackApi } from '@/api';

export const LOCATION_TRACKING_TASK = 'LOCATION_TRACKING_TASK';
const STORAGE_KEY_ACCUMULATED_DISTANCE = 'tracking_accumulated_distance';
const STORAGE_KEY_LAST_COORDINATE = 'tracking_last_coordinate';
const STORAGE_KEY_LAST_SYNC_TIME = 'tracking_last_sync_time';
const STORAGE_KEY_LAST_SYNC_COORDINATE = 'tracking_last_sync_coordinate';
const STORAGE_KEY_LAST_SYNC_HEADING = 'tracking_last_sync_heading';
/** Device ID y token para el task en segundo plano (pantalla apagada / cold start). */
const STORAGE_KEY_TRACKING_DEVICE_ID = 'tracking_device_id';
const STORAGE_KEY_TRACKING_AUTH_TOKEN = 'tracking_auth_token';

const NOTIFICATION_ID = 'live_tracking';
const CHANNEL_ID = 'live_channel_v2';
const WAKE_LOCK_TAG = 'location-tracking';
const SYNC_CHANNEL_ID = 'sync_channel';
const IOS_CATEGORY_ID = 'tracking_actions_category';

const SYNC_INTERVAL_MS = 60000; // 60 segundos
const SYNC_DISTANCE_METERS = 3000; // 3000 metros
const SYNC_ANGLE_DEGREES = 35; // 35 grados
const MIN_SPEED_KMH = 0.1; 

// Variables en memoria para acceso rápido durante la ejecución de la tarea
let memLastCoordinate: { latitude: number; longitude: number } | null = null;
let memLastSyncCoordinate: { latitude: number; longitude: number } | null = null;
let memLastSyncHeading: number | null = null;
let memAccumulatedDistance = 0;
let isStateHydrated = false;
let memLastSyncTime: number | null = null;

// Variable para guardar el tiempo de inicio y usar el cronómetro nativo
let startTime: number | null = null;

export class LocationTrackingService {

    /**
     * Configura el canal para Android y las Categorías de botones para iOS
     */
    private static async setupNotificationsConfig() {
        if (Platform.OS === 'android') {
            await notifee.createChannel({
                id: CHANNEL_ID,
                name: 'Seguimiento en Curso',
                lights: false,
                vibration: false,
                importance: AndroidImportance.LOW,
                sound: undefined,
            });

            await notifee.createChannel({
                id: SYNC_CHANNEL_ID,
                name: 'Sincronización de Datos',
                lights: true,
                vibration: true,
                importance: AndroidImportance.HIGH,
            });
        } else if (Platform.OS === 'ios') {
            await notifee.setNotificationCategories([
                {
                    id: IOS_CATEGORY_ID,
                    actions: [
                        { id: 'FINISH_TRACKING', title: 'Finalizar Ruta', foreground: true, destructive: true },
                    ],
                },
            ]);
        }
    }

    private static stopForegroundPromise: (() => void) | null = null;

    /**
     * Registra el callback para detener la promesa del servicio en primer plano.
     */
    public static registerStopForegroundCallback(callback: () => void) {
        this.stopForegroundPromise = callback;
    }

    /**
     * Inicializa el listener del Foreground Service de Notifee una sola vez.
     */
    private static isForegroundServiceRegistered = false;
    public static setupForegroundService() {
        if (this.isForegroundServiceRegistered) return;

        notifee.registerForegroundService((notification) => {
            return new Promise((resolve) => {
                console.log("[LocationTracking] Notifee Foreground Service iniciado");

                this.registerStopForegroundCallback(() => {
                    console.log("[LocationTracking] Resolviendo promesa de Foreground Service");
                    resolve();
                });

                const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
                    if (type === 7 /* DISMISSED */) {
                        console.log("[LocationTracking] Notificación descartada, resolviendo promesa");
                        resolve();
                        unsubscribe();
                    }
                });
            });
        });

        this.isForegroundServiceRegistered = true;
    }

    /**
     * Inicia el seguimiento en segundo plano.
     */
    public static async startTracking(forceRestart: boolean = true) {
        if (Platform.OS === 'android') {
            this.setupForegroundService();
            const { runOptimizationSetupIfNeeded } = require('./OptimizationSetupService');
            await runOptimizationSetupIfNeeded();
        }

        if (Platform.OS === 'android' && (Platform.Version as number) >= 33) {
            await Notifications.requestPermissionsAsync();
        }
        
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
            console.error('Permisos de ubicación en primer plano insuficientes');
            return;
        }

        if (Platform.OS === 'android') {
            const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
            if (bgStatus !== 'granted') {
                console.error('Permisos de ubicación en segundo plano insuficientes');
                return;
            }
        }

        await this.setupNotificationsConfig();

        if (forceRestart) {
            await AsyncStorage.removeItem(STORAGE_KEY_ACCUMULATED_DISTANCE);
            await AsyncStorage.removeItem(STORAGE_KEY_LAST_COORDINATE);
            await AsyncStorage.removeItem(STORAGE_KEY_LAST_SYNC_TIME);
            await AsyncStorage.removeItem(STORAGE_KEY_LAST_SYNC_COORDINATE);
            await AsyncStorage.removeItem(STORAGE_KEY_LAST_SYNC_HEADING);
            memAccumulatedDistance = 0;
            memLastCoordinate = null;
            memLastSyncCoordinate = null;
            memLastSyncHeading = null;
            isStateHydrated = true;
            startTime = Date.now();
        }

        const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
        if (isStarted && !forceRestart) {
            console.log(`Tracking ya activo`);
            return;
        }

        try {
            console.log(`[LocationTracking] Iniciando updates con task: ${LOCATION_TRACKING_TASK}`);
            
            // Asegurar que las categorías de notificación de Expo estén listas antes de iniciar tracking
            // Aunque Notifee maneja el Foreground Service, Expo Location puede usar expo-notifications internamente en Android.
            if (Platform.OS === 'android') {
                try {
                    const { setupNotificationCategories } = require('./NotificationService');
                    await setupNotificationCategories();
                } catch (notifError) {
                    console.warn('[LocationTracking] No se pudieron configurar categorías de notificación:', notifError);
                }
            }

            await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
                accuracy: Location.Accuracy.BestForNavigation,
                // le pido al gps que me envíe una posición cada 10 segundos
                timeInterval: 10000, 
                distanceInterval: 0, // Set to 0 to receive ALL updates and filter them in JS
                showsBackgroundLocationIndicator: true,
                foregroundService: {
                    notificationTitle: 'GPS Activo',
                    notificationBody: 'Transmitiendo ubicación...',
                    notificationColor: '#8E24AA',
                },
                pausesUpdatesAutomatically: false,
                activityType: Location.ActivityType.AutomotiveNavigation,
            });

            console.log(`✅ Tracking iniciado exitosamente - Task: ${LOCATION_TRACKING_TASK}`);

            // Wake Lock: evita que el dispositivo entre en modo ahorro profundo durante el rastreo
            // (reduce probabilidad de que Android detenga el envío de posiciones con pantalla apagada)
            if (Platform.OS === 'android') {
                try {
                    await KeepAwake.activateKeepAwakeAsync(WAKE_LOCK_TAG);
                    console.log('[LocationTracking] Wake Lock activado');
                } catch (wakeErr) {
                    console.warn('[LocationTracking] No se pudo activar Wake Lock:', wakeErr);
                }
            }

            // Persistir device ID y token para el task en segundo plano (pantalla apagada / cold start)
            try {
                const { useDeviceStore } = require('@/store/deviceStore');
                const currentDevice = useDeviceStore.getState().currentDevice;
                const authHeader = EjetrackApi.defaults.headers.common['Authorization'] as string | undefined;
                if (currentDevice?.id) {
                    await AsyncStorage.setItem(STORAGE_KEY_TRACKING_DEVICE_ID, String(currentDevice.id));
                }
                if (authHeader && typeof authHeader === 'string') {
                    await AsyncStorage.setItem(STORAGE_KEY_TRACKING_AUTH_TOKEN, authHeader);
                }
            } catch (persistErr) {
                console.warn('[LocationTracking] No se pudieron persistir device/token para background:', persistErr);
            }

            // Envío inicial de ubicación para validar que Ejetrack reciba la señal al iniciar ruta
            try {
                const lastPos = await Location.getLastKnownPositionAsync();
                console.log(`[LocationTracking] Posición conocida actual:`, lastPos ? `${lastPos.coords.latitude}, ${lastPos.coords.longitude}` : 'Ninguna');
                
                const { useDeviceStore } = require('@/store/deviceStore');
                const currentDevice = useDeviceStore.getState().currentDevice;
                console.log(`[LocationTracking] Dispositivo en store:`, currentDevice ? `ID: ${currentDevice.id}` : 'NINGUNO');

                if (lastPos) {
                    if (currentDevice && currentDevice.id) {
                        // Obtener nivel de batería
                        const batteryLevel = await Battery.getBatteryLevelAsync();
                        const batteryPct = Math.round(batteryLevel * 100);
                        console.log(`[LocationTracking] Nivel de batería inicial: ${batteryPct}%`);

                        const osmanPayload = EjetrackService.mapToOsman(
                            currentDevice.id.toString(),
                            lastPos,
                            {
                                ignition: true,
                                event: 239,
                                priority: 1,
                                battery: batteryPct
                            }
                        );
                        console.log(`[LocationTracking] 🚀 Enviando ubicación inicial de "Inicio de Ruta" para dispositivo: ${currentDevice.id}`);
                        EjetrackService.sendLocation(osmanPayload);
                    } else {
                        console.warn('[LocationTracking] ⚠️ No hay dispositivo configurado para enviar ubicación inicial');
                    }
                } else {
                    console.warn('[LocationTracking] ⚠️ No se obtuvo la última posición conocida para el envío inicial');
                }
            } catch (initLocationError) {
                console.warn('[LocationTracking] No se pudo enviar ubicación inicial:', initLocationError);
            }

            // Mostrar notificación inicial
            await this.updateProgressNotification(0, 0, "Iniciando...");

        } catch (error: any) {
            if (Platform.OS === 'android' && error?.message?.includes('background')) {
                console.warn('⚠️ [LocationTracking] No se pudo iniciar el servicio porque la app está en segundo plano.');
                return;
            }
            console.error('[LocationTracking] Error crítico al iniciar updates:', error);
        }
    }

    /**
     * Verifica si el seguimiento está activo.
     */
    public static async isTrackingActive(): Promise<boolean> {
        return await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    }

    /**
     * Detiene el seguimiento y limpia notificaciones.
     */
    public static async stopTracking() {
        const isStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
        
        // Enviar registro final con ignition: false antes de detener
        try {
            const lastPos = await Location.getLastKnownPositionAsync();
            const { useDeviceStore } = require('@/store/deviceStore');
            const currentDevice = useDeviceStore.getState().currentDevice;

            if (lastPos && currentDevice && currentDevice.id) {
                let batteryPct = 100;
                try {
                    const batteryLevel = await Battery.getBatteryLevelAsync();
                    batteryPct = Math.round(batteryLevel * 100);
                } catch (e) {}

                const osmanPayload = EjetrackService.mapToOsman(
                    currentDevice.id.toString(),
                    lastPos,
                    {
                        ignition: false,
                        event: 239,
                        priority: 1,
                        battery: batteryPct
                    }
                );
                console.log(`[LocationTracking] 🛑 Guardando y enviando ubicación final de "Fin de Ruta" (ignition: false) para dispositivo: ${currentDevice.id}`);
                
                // En lugar de forzar el envío, simplemente guardamos el evento de fin
                // El BackgroundSyncService o la próxima vez que el servidor sea accesible se encargarán de sincronizar.
                await EjetrackService.saveLocationOffline(osmanPayload);
                console.log('[LocationTracking] ✨ Ubicación final guardada. El sistema de fondo la sincronizará.');
            }
        } catch (finalLocationError) {
            console.warn('[LocationTracking] No se pudo procesar ubicación final:', finalLocationError);
        }

        if (isStarted) {
            try {
                // [SAFE-SHUTDOWN] Await estricto antes de detener el servicio
                await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
                console.log('[LocationTracking] Location updates stopped successfully');
            } catch (stopLocError) {
                console.warn('[LocationTracking] Error stopping location updates:', stopLocError);
            }
        }
    
        // Liberar Wake Lock
        if (Platform.OS === 'android') {
            try {
                await KeepAwake.deactivateKeepAwake(WAKE_LOCK_TAG);
                console.log('[LocationTracking] Wake Lock liberado');
            } catch (wakeErr) {
                console.warn('[LocationTracking] Error al liberar Wake Lock:', wakeErr);
            }
        }

        memLastCoordinate = null;
        memAccumulatedDistance = 0;
        isStateHydrated = false;
        memLastSyncTime = null;
        startTime = null;
        await AsyncStorage.removeItem(STORAGE_KEY_ACCUMULATED_DISTANCE);
        await AsyncStorage.removeItem(STORAGE_KEY_LAST_COORDINATE);
        await AsyncStorage.removeItem(STORAGE_KEY_LAST_SYNC_TIME);
        await AsyncStorage.removeItem(STORAGE_KEY_LAST_SYNC_COORDINATE);
        await AsyncStorage.removeItem(STORAGE_KEY_LAST_SYNC_HEADING);
        await AsyncStorage.removeItem(STORAGE_KEY_TRACKING_DEVICE_ID);
        await AsyncStorage.removeItem(STORAGE_KEY_TRACKING_AUTH_TOKEN);

        // Cancelar explícitamente la notificación de tracking por ID con bloque try/catch específico
        try {
            await notifee.stopForegroundService();
            await notifee.cancelNotification(NOTIFICATION_ID);
            console.log('[LocationTracking] Notificación de servicio detenida y cancelada');
        } catch (notifCleanupError) {
            console.warn('[LocationTracking] Error específico en limpieza de notifee (no crítico):', notifCleanupError);
        }
        
        // Resolver la promesa del foreground service si existe
        if (this.stopForegroundPromise) {
            console.log('[LocationTracking] Resolviendo promesa de foreground service');
            this.stopForegroundPromise();
            this.stopForegroundPromise = null;
        }

        // Cerrar todas las demás notificaciones de la app con protección try/catch
        try {
            await notifee.cancelAllNotifications();
        } catch (cancelAllError) {
            console.warn('[LocationTracking] Error al cancelar todas las notificaciones:', cancelAllError);
        }
        
        // Sincronización final de paquetes pendientes (100 en 100) al finalizar la ruta
        console.log('[LocationTracking] Disparando sincronización final de pendientes...');
        EjetrackService.processPendingLocations(true).catch(err =>
            console.error('[LocationTracking] Error en sincronización final:', err)
        );

        console.log('🛑 Tracking detenido y notificaciones cerradas');
    }

    /**
     * Actualiza la notificación visual (Widget).
     */
    public static async updateProgressNotification(
        distanceKm: number,
        speedKmh: number,
        elapsedTime: string
    ) {
        await this.setupNotificationsConfig();

        if (Platform.OS === 'android') {
            // No usar asForegroundService: true aquí: expo-location ya inicia su propio
            // Foreground Service. Dos servicios en paralelo hacen que Android pueda detener
            // las actualizaciones de ubicación cuando se apaga la pantalla.
            await notifee.displayNotification({
                id: NOTIFICATION_ID,
                title: `Ruta en curso`,
                body: `Distancia: ${distanceKm.toFixed(2)} km  •  Vel: ${speedKmh.toFixed(0)} km/h`,
                android: {
                    channelId: CHANNEL_ID,
                    asForegroundService: false,
                    ongoing: true,
                    onlyAlertOnce: true,
                    color: '#4CAF50',
                    colorized: true,
                    smallIcon: 'ic_launcher',
                    style: {
                        type: AndroidStyle.BIGTEXT,
                        text: `Distancia: ${distanceKm.toFixed(2)} km\nVelocidad: ${speedKmh.toFixed(0)} km/h`
                    },
                    timestamp: startTime || Date.now(),
                    showTimestamp: true,
                    chronometerDirection: 'up',
                    actions: [
                        { title: 'FINALIZAR RUTA', pressAction: { id: 'FINISH_TRACKING', launchActivity: 'default' } },
                    ],
                    category: AndroidCategory.SERVICE,
                    visibility: AndroidVisibility.PUBLIC,
                },
            });
        } else if (Platform.OS === 'ios') {
            await notifee.displayNotification({
                id: NOTIFICATION_ID,
                title: `Ruta en curso • ${elapsedTime}`,
                body: `Recorrido: ${distanceKm.toFixed(2)} km`,
                ios: {
                    categoryId: IOS_CATEGORY_ID,
                    sound: undefined,
                    critical: false,
                    interruptionLevel: 'active',
                },
            });
        }
    }

    /**
     * Sincroniza manualmente la notificación desde la UI.
     */
    public static async syncNotificationProgress() {
        if (!isStateHydrated) {
            const savedDistance = await AsyncStorage.getItem(STORAGE_KEY_ACCUMULATED_DISTANCE);
            if (savedDistance) memAccumulatedDistance = parseFloat(savedDistance);
            isStateHydrated = true;
        }

        let elapsedTime = 'En curso';
        if (startTime) {
            const diffMs = Date.now() - startTime;
            const diffMins = Math.floor(diffMs / 60000);
            elapsedTime = `${Math.floor(diffMins / 60).toString().padStart(2,'0')}:${(diffMins % 60).toString().padStart(2,'0')}`;
        }

        await this.updateProgressNotification(
            memAccumulatedDistance / 1000,
            0,
            elapsedTime
        );
    }
}

// El registro de la Tarea en segundo plano se hace aquí, pero la lógica interna
// debe ser extremadamente cuidadosa con el cold start.
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }: any) => {
    if (error) {
        console.error(`[LocationTrackingTask] Error:`, error);
        return;
    }
    if (data) {
        const { locations } = data;
        
        // 0. Asegurar inicialización mínima de DB para cold start
        try {
            const { databaseService } = require('@/database/DatabaseService');
            // getDB() en DatabaseService es sincrónico (openDatabaseSync)
            const db = databaseService.getDB();
            if (!db) {
                console.warn(`[LocationTrackingTask] 🛑 DB no lista aún en cold start.`);
                return;
            }
        } catch (dbError) {
            console.error(`[LocationTrackingTask] Error accediendo a DB en cold start:`, dbError);
            return;
        }

        // 1. State Hydration - PRIORITARIA
        if (!isStateHydrated) {
            try {
                const [savedDistance, savedLastCoord, savedSyncTime, savedSyncCoord, savedSyncHeading] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEY_ACCUMULATED_DISTANCE),
                    AsyncStorage.getItem(STORAGE_KEY_LAST_COORDINATE),
                    AsyncStorage.getItem(STORAGE_KEY_LAST_SYNC_TIME),
                    AsyncStorage.getItem(STORAGE_KEY_LAST_SYNC_COORDINATE),
                    AsyncStorage.getItem(STORAGE_KEY_LAST_SYNC_HEADING)
                ]);

                if (savedDistance) memAccumulatedDistance = parseFloat(savedDistance);
                if (savedLastCoord) memLastCoordinate = JSON.parse(savedLastCoord);
                if (savedSyncTime) memLastSyncTime = parseInt(savedSyncTime);
                if (savedSyncCoord) memLastSyncCoordinate = JSON.parse(savedSyncCoord);
                if (savedSyncHeading) memLastSyncHeading = parseFloat(savedSyncHeading);

                isStateHydrated = true;
                console.log(`[LocationTrackingTask] State hydrated: dist=${memAccumulatedDistance}m`);
            } catch (hydrationError) {
                console.error(`[LocationTrackingTask] Hydration error:`, hydrationError);
            }
        }

        // Refuerzo de hidratación si las variables críticas son nulas a pesar de isStateHydrated
        if (memAccumulatedDistance === null || memLastSyncTime === null) {
            console.log(`[LocationTrackingTask] Forced re-hydration check...`);
            const savedDistance = await AsyncStorage.getItem(STORAGE_KEY_ACCUMULATED_DISTANCE);
            if (savedDistance !== null) memAccumulatedDistance = parseFloat(savedDistance);
            const savedSyncTime = await AsyncStorage.getItem(STORAGE_KEY_LAST_SYNC_TIME);
            if (savedSyncTime !== null) memLastSyncTime = parseInt(savedSyncTime);
        }

        let lastSyncTime = memLastSyncTime || 0;

        let currentSpeed = 0;
        let hasValidUpdate = false; 

        for (const location of locations) {
            const { latitude, longitude, speed, heading, accuracy } = location.coords;
            
            // --- FILTER 1: ACCURACY (Anti-ZigZag) ---
            // Discard points with high uncertainty (> 25m radius)
            if (accuracy && accuracy > 25) {
                console.log(`[GPS] Ignored bad accuracy: ${accuracy}m`);
                continue; 
            }

            currentSpeed = speed ?? 0;
            const speedKmh = currentSpeed * 3.6;

            // --- FILTER 2: ANTI-DRIFT ---
            // No enviar posición cuando el dispositivo está quieto (< 0.1 km/h)
            if (speedKmh < MIN_SPEED_KMH) {
                console.log(`[GPS] Ignored stationary (${speedKmh.toFixed(2)} km/h < ${MIN_SPEED_KMH})`);
                continue;
            }

            // Distancia desde el último punto (para acumular recorrido)
            const distFromLast = memLastCoordinate 
                ? getDistance(memLastCoordinate.latitude, memLastCoordinate.longitude, latitude, longitude)
                : 0;

            // --- VALID POINT LOGIC ---
            hasValidUpdate = true;

            if (memLastCoordinate) {
                memAccumulatedDistance += distFromLast;
            }
            memLastCoordinate = { latitude, longitude };

            // Sync Logic
            const timeDiff = Date.now() - lastSyncTime;
            let distanceDiff = 0;
            let angleDiff = 0;

            const nowUnix = Math.floor(Date.now() / 1000);
            const lastSyncUnix = Math.floor(lastSyncTime / 1000);
            const timeDiffSec = nowUnix - lastSyncUnix;
            const SYNC_INTERVAL_SEC = Math.floor(SYNC_INTERVAL_MS / 1000);

            if (memLastSyncCoordinate) {
                distanceDiff = getDistance(
                    memLastSyncCoordinate.latitude,
                    memLastSyncCoordinate.longitude,
                    latitude,
                    longitude
                );
            }

            if (memLastSyncHeading !== null && heading !== null) {
                angleDiff = Math.abs(memLastSyncHeading - heading);
                if (angleDiff > 180) angleDiff = 360 - angleDiff;
            }

            const shouldSync = timeDiffSec >= SYNC_INTERVAL_SEC || 
                               distanceDiff >= SYNC_DISTANCE_METERS || 
                               angleDiff >= SYNC_ANGLE_DEGREES;

            if (shouldSync) {
                console.log(`[LocationTrackingTask] 🔄 Sync: T=${timeDiffSec}s, D=${distanceDiff.toFixed(1)}m`);
                
                const { useDeviceStore } = require('@/store/deviceStore');
                let deviceId: string | null = useDeviceStore.getState().currentDevice?.id?.toString() ?? null;
                if (!deviceId) {
                    const persistedId = await AsyncStorage.getItem(STORAGE_KEY_TRACKING_DEVICE_ID);
                    if (persistedId) deviceId = persistedId;
                }
                if (!EjetrackApi.defaults.headers.common['Authorization']) {
                    const persistedToken = await AsyncStorage.getItem(STORAGE_KEY_TRACKING_AUTH_TOKEN);
                    if (persistedToken) {
                        EjetrackApi.defaults.headers.common['Authorization'] = persistedToken;
                        console.log('[LocationTrackingTask] Token restaurado desde almacenamiento para envío en segundo plano.');
                    }
                }

                if (deviceId) {
                    let batteryPct = 100;
                    try {
                        const batteryLevel = await Battery.getBatteryLevelAsync();
                        batteryPct = Math.round(batteryLevel * 100);
                    } catch (batErr) {}

                    const osmanPayload = EjetrackService.mapToOsman(
                        deviceId,
                        location, 
                        {
                            ignition: true,
                            event: 0,
                            priority: 1,
                            battery: batteryPct
                        }
                    );

                    // 1. Envío prioritario del punto actual (sin esperar)
                    EjetrackService.sendLocation(osmanPayload).catch(err => 
                        console.error('[LocationTrackingTask] Error en sendLocation prioritario:', err)
                    );
                    
                    // Nota: sendLocation ya dispara processPendingLocations() internamente
                    // después de intentar el envío prioritario y guardar en DB.
                } else {
                    console.warn('[LocationTrackingTask] Sin device_id en store ni persistido, no se envía ubicación.');
                }

                memLastSyncTime = Date.now();
                memLastSyncCoordinate = { latitude, longitude };
                memLastSyncHeading = heading || 0;

                await AsyncStorage.setItem(STORAGE_KEY_LAST_SYNC_TIME, memLastSyncTime.toString());
                await AsyncStorage.setItem(STORAGE_KEY_LAST_SYNC_COORDINATE, JSON.stringify(memLastSyncCoordinate));
                await AsyncStorage.setItem(STORAGE_KEY_LAST_SYNC_HEADING, memLastSyncHeading.toString());
            }
        }

        // Only update storage and notification if we had at least one VALID point
        if (hasValidUpdate) {
            await AsyncStorage.setItem(STORAGE_KEY_ACCUMULATED_DISTANCE, memAccumulatedDistance.toString());
            await AsyncStorage.setItem(STORAGE_KEY_LAST_COORDINATE, JSON.stringify(memLastCoordinate));

            let elapsedTime = '00:00';
            if (startTime) {
                const diffMs = Date.now() - startTime;
                const diffMins = Math.floor(diffMs / 60000);
                const diffHrs = Math.floor(diffMins / 60);
                const mins = diffMins % 60;
                elapsedTime = `${diffHrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
            }

            const distanceKm = memAccumulatedDistance / 1000;
            const speedKmh = currentSpeed * 3.6;

            const stillActive = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK);
            if (stillActive) {
                await LocationTrackingService.updateProgressNotification(
                    distanceKm,
                    speedKmh,
                    elapsedTime
                );
            }
        }
    }
});