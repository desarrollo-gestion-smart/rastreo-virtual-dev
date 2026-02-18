import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useTravelStatusLogStore } from '@/store/travelStatusLogStore';
import { useServerConnection } from './use-server-connection';
import { EjetrackService } from '@/services/EjetrackService';
import { useShallow } from 'zustand/react/shallow';

export const useBackgroundSync = () => {
    const { isServerReachable } = useServerConnection();
    const { isAuthenticated, isHydrated } = useAuthStore(useShallow(state => ({
        isAuthenticated: state.isAuthenticated,
        isHydrated: state.isHydrated
    })));
    
    const syncStatusLogs = useTravelStatusLogStore(state => state.syncPendingLogs);

    useEffect(() => {
        if (isHydrated && isServerReachable === true && isAuthenticated) {
            console.log("🚀 Servidor confirmado y accesible. Iniciando sincronización...");
            
            Promise.allSettled([
                syncStatusLogs().then(() => console.log("  - Logs de estado sincronizados.")),
                EjetrackService.processPendingLocations(true).then(() => console.log("  - Ubicaciones pendientes procesadas.")),
            ]).then(() => {
                console.log("✅ Sincronización finalizada exitosamente.");
            });
        } else if (isServerReachable === false && isAuthenticated) {
            console.log("⏸️ Sincronización pausada: No hay acceso al servidor.");
        }
    }, [isServerReachable, isAuthenticated, isHydrated]); 
};