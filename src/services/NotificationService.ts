import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';

// 🛑 ¡IMPORTANTE! NO IMPORTES NINGÚN OTRO SERVICIO O STORE AQUÍ ARRIBA.
// Si importas 'formStore' o 'formService' aquí, la app crasheará al inicio.

Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        // 1. Leemos los datos que vienen en la push
        const data:any = notification.request.content.data;
        
        // 2. Definimos qué tipos de notificaciones deben ser SILENCIOSAS en primer plano
        // (Agrega aquí todos los tipos que sean solo para actualizar la BD)
        const silentTypes = ['SYNC_FORM', 'SYNC_DEVICE', 'UPDATE_DEVICE', 'DELETE_DEVICE'];

        // 3. Verificamos: Si es de tipo "silencioso", ocultamos todo.
        if (data.type && silentTypes.includes(data.type)) {
            return {
                shouldShowBanner: false,
                shouldShowList: false,
                shouldPlaySound: false, // <--- ESTO EVITA EL SONIDO
                shouldSetBadge: false,
            };
        }

        // 4. Para cualquier otro tipo (ej: "Mensaje Importante"), SÍ mostramos alerta
        return {
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
        };
    },
});

/**
 * Configures notification categories for the app.
 */
export const setupNotificationCategories = async () => {
    if (Platform.OS === 'web') return;

    await Notifications.setNotificationCategoryAsync('TRACKING_ACTIONS', [
        {
            identifier: 'FINISH_TRACKING',
            buttonTitle: 'Finalizar Ruta',
            options: { opensAppToForeground: true },
        },
    ]);

    await Notifications.setNotificationCategoryAsync('ROUTE_START_CATEGORY', [
        {
            identifier: 'START_ROUTE',
            buttonTitle: 'Iniciar Ruta',
            options: { opensAppToForeground: true },
        },
    ]);

    await Notifications.setNotificationCategoryAsync('ROUTE_END_CATEGORY', [
        {
            identifier: 'END_ROUTE',
            buttonTitle: 'Finalizar Ruta',
            options: { opensAppToForeground: true },
        },
    ]);
};

/**
 * Función auxiliar para manejar la lógica de datos.
 */
const handleNotificationData = async (data: any) => {
    if (!data) return;
    console.log("Procesando datos de notificación:", data);

    try {
        const { deviceService } = require('./DeviceService');
         
        if (data.type === 'SYNC_DEVICE' || data.type === 'UPDATE_DEVICE' && data.device_id) {
             const deviceId = Number(data.device_id);
            if (deviceId) {
                await deviceService.syncDeviceById(deviceId);
                
                const { useDeviceStore } = require('@/store/deviceStore');
             useDeviceStore.getState().hydrate();
            }
        }

        // CASO 2: Eliminar Dispositivo
        if (data.type === 'DELETE_DEVICE'&& data.device_id) {
             const deviceId = Number(data.device_id);
            if (deviceId) {
                await deviceService.deleteDeviceLocal(deviceId);
                
                const { useDeviceStore } = require('@/store/deviceStore');
                useDeviceStore.getState().hydrate();
            }
        }

        if (data.type === 'SYNC_ALL') {
            console.log("🚀 Iniciando Sincronización Completa vía Push...");
            const { useAuthStore } = require('@/store/authStore');
            const currentUser = useAuthStore.getState().currentUser;

            if (currentUser) {
                useAuthStore.getState().syncInitialData(currentUser);
                
                setTimeout(() => {
                    router.push('/sync');
                }, 100);
            }
            return;
        }

        if (data.type === 'START_ROUTE') {
            console.log("🚀 Iniciando Ruta vía Push...");
            const { LocationTrackingService } = require('./LocationTrackingService');
            await LocationTrackingService.startTracking();
            return;
        }

        if (data.type === 'END_ROUTE') {
            console.log("🛑 Finalizando Ruta vía Push...");
            const { LocationTrackingService } = require('./LocationTrackingService');
            await LocationTrackingService.stopTracking();
            return;
        }

    } catch (error) {
        console.error("Error procesando notificación:", error);
    }
};

// Objeto simple (NO ES UNA CLASE) para evitar problemas de prototipos
export const notificationService = {
    
    async registerForPushNotificationsAsync(): Promise<string | undefined> {
        let token;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
                enableVibrate: true,
                showBadge: true,
            });

            await Notifications.setNotificationChannelAsync('routes', {
                name: 'Rutas',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
                enableVibrate: true,
                showBadge: true,
                sound: 'default',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            
            if (finalStatus !== 'granted') {
                console.log('Permiso de notificaciones denegado.');
                return;
            }

            const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
            try {
                token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
                console.log('Expo Push Token:', token);
            } catch (e) {
                console.error("Error obteniendo token:", e);
            }
        } else {
            console.log('Debes usar un dispositivo físico para Push.');
        }

        return token;
    },

    setupNotificationListeners(): () => void {
        console.log("Configurando listeners...");
        
        const receivedSubscription = Notifications.addNotificationReceivedListener(notification => {
            const data = notification.request.content.data;
            handleNotificationData(data);
        });

        const responseSubscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
            const data: any = response.notification.request.content.data;
            const actionId = response.actionIdentifier;

            console.log("Notificación interactuada:", actionId, data);

            if (actionId === 'FINISH_TRACKING' || actionId === 'END_ROUTE') {
                // Notifee maneja esto ahora para la notificación de viaje
                return;
            }

            if (actionId === 'START_ROUTE') {
                // El inicio también se procesa vía handleNotificationData que se llama abajo
            }

            handleNotificationData(data);
        });

        return () => {
            console.log("Limpiando suscripciones...");
            receivedSubscription?.remove();
            responseSubscription?.remove();
        };
    }
};