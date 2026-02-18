import notifee, { EventType } from '@notifee/react-native';
import { useTripStore } from '@/store/tripStore';
import { LocationTrackingService } from '@/services/LocationTrackingService';

/**
 * Listener de Fondo para Notifee.
 * Maneja interacciones cuando la app no está en primer plano.
 */
notifee.onBackgroundEvent(async ({ type, detail }) => {
    const { pressAction } = detail;

    // Solo nos interesan los clics en acciones (botones)
    if (type === EventType.ACTION_PRESS && pressAction?.id) {
        console.log(`[Background] Acción recibida: ${pressAction.id}`);

        // Manejar FINALIZAR RUTA desde el fondo (si aplica)
        if (pressAction.id === 'FINISH_TRACKING') {
            try {
                // Detener el servicio de GPS
                await LocationTrackingService.stopTracking();
                
                // Actualizar el estado global
                await useTripStore.getState().setIsTrackingActive(false);

                console.log('[Background] Seguimiento finalizado con éxito.');
            } catch (error) {
                console.error('[Background] Error al finalizar seguimiento:', error);
            }
        }

        // Manejar SINCRONIZACIÓN MANUAL desde el fondo
        if (pressAction.id === 'SYNC_PENDING_POINTS') {
            try {
                const { EjetrackService } = require('@/services/EjetrackService');
                const { pendingLocationService } = require('@/services/PendingLocationService');
                
                // Forzar sincronización
                await EjetrackService.processPendingLocations(true);
                
                const pendingCount = await pendingLocationService.getPendingCount();
                if (pendingCount > 0) {
                    // Si falla, volver a notificar (recursión manual via usuario)
                    await notifee.displayNotification({
                        id: 'SYNC_PENDING_POINTS',
                        title: 'Puntos sin enviar',
                        body: `Aún quedan ${pendingCount} puntos pendientes. Reintenta cuando tengas internet.`,
                        android: {
                            channelId: 'sync_channel',
                            pressAction: {
                                id: 'SYNC_PENDING_POINTS',
                            },
                            importance: 4, // AndroidImportance.HIGH
                            ongoing: true,
                            autoCancel: false
                        },
                    });
                } else {
                    // Si se enviaron todos, limpiar la notificación específica
                    await notifee.cancelNotification('SYNC_PENDING_POINTS');
                }
            } catch (error) {
                console.error('[Background] Error al sincronizar puntos pendientes:', error);
            }
        }
    }
});