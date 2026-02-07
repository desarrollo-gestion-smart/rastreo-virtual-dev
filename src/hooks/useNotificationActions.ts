import { useEffect } from 'react';
import notifee, { EventType } from '@notifee/react-native';
import { useRouter } from 'expo-router';
import { useTravelStatusLogStore } from '@/store/travelStatusLogStore';
import { useTripStore } from '@/store/tripStore';

export const useNotificationActions = () => {
    const router = useRouter();

    useEffect(() => {
        // Listener de Primer Plano (Foreground)
        const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
            if (type === EventType.ACTION_PRESS && detail.pressAction?.id) {
                handleAction(detail.pressAction.id);
            }
        });

        return () => unsubscribe();
    }, []);

    const handleAction = async (actionId: string) => {
        const activeTrip = useTripStore.getState().activeTrip;
        
        console.log(`[Foreground] Ejecutando acción: ${actionId}`);

        if (actionId === 'START_ROUTE') {
            try {
                const { LocationTrackingService } = require('@/services/LocationTrackingService');
                await LocationTrackingService.startTracking();
                console.log('[Foreground] Ruta iniciada con éxito vía acción.');
            } catch (error) {
                console.error('[Foreground] Error al iniciar ruta vía acción:', error);
            }
            return;
        }

        if (actionId === 'FINISH_TRACKING' || actionId === 'END_ROUTE') {
            try {
                const { LocationTrackingService } = require('@/services/LocationTrackingService');
                // Detener el servicio de GPS
                await LocationTrackingService.stopTracking();
                
                // Actualizar el estado global
                await useTripStore.getState().setIsTrackingActive(false);

                console.log('[Foreground] Seguimiento finalizado con éxito.');
            } catch (error) {
                console.error('[Foreground] Error al finalizar seguimiento:', error);
            }
            return;
        }

        if (actionId === 'SYNC_PENDING_POINTS') {
            try {
                const { EjetrackService } = require('@/services/EjetrackService');
                const { pendingLocationService } = require('@/services/PendingLocationService');
                
                await EjetrackService.processPendingLocations(true);
                
                const pendingCount = await pendingLocationService.getPendingCount();
                if (pendingCount === 0) {
                    // Si se enviaron todos, limpiar notificaciones de sync
                    await notifee.cancelNotification('SYNC_PENDING_POINTS');
                }
            } catch (error) {
                console.error('[Foreground] Error al sincronizar puntos pendientes:', error);
            }
            return;
        }

        if (!activeTrip) return;

        if (actionId === 'FINISH_TRIP') {
            try {
                // Navegar al detalle para confirmar finalización o ver resumen
                router.push(`/(app)/trips/${activeTrip.id}`);

                // Opcional: Ejecutar lógica de finalización directa si se prefiere
                await useTravelStatusLogStore.getState().changeTripStatus(activeTrip.id, 3);
            } catch(e) {
                console.error("Error al finalizar viaje:", e);
            }
        }
        else if (actionId === 'PAUSE_TRIP') {
            // Si el usuario tenía la app abierta y pulsó pausar en la notificación
            try {
                await useTravelStatusLogStore.getState().changeTripStatus(activeTrip.id, 4);
            } catch(e) {
                console.error("Error al pausar viaje:", e);
            }
        }
    };
};