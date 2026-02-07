import { useEffect, useCallback, useRef } from 'react';
import { useNetInfo } from '@react-native-community/netinfo';
import { AppsApi } from '@/api'; 
import { useServerStore } from '@/store/serverStore';
import { EjetrackService } from '@/services/EjetrackService';
import { useAuthStore } from '@/store/authStore';

export const useServerConnection = () => {
    const netInfo = useNetInfo();
    const { isAuthenticated, isHydrated } = useAuthStore();
    const { 
        isServerReachable, 
        isChecking, 
        serverData, 
        setServerReachable, 
        setChecking, 
        setServerData 
    } = useServerStore();
    
    // Referencia para evitar llamadas simultáneas (Debounce manual) a nivel de instancia
    // y para evitar re-entradas si se usa en varios componentes
    const isRequestingRef = useRef(false);

    const checkServer = useCallback(async () => {
        // 1. Si no hay hardware de red, marcamos offline inmediato
        if (netInfo.isConnected === false) {
            setServerReachable(false);
            return;
        }

        // 2. Si ya hay una petición en vuelo (local o global), NO lanzamos otra
        // Accedemos al estado actual del store para evitar dependencias circulares
        const { isChecking: globalIsChecking } = useServerStore.getState();
        if (isRequestingRef.current || globalIsChecking) return;

        // Iniciamos bloqueo
        isRequestingRef.current = true;
        setChecking(true);

        try {
            // Usamos la URL que mencionaste que devuelve la versión
            // Timeout corto para no congelar la UI si la red es lenta
            const response = await AppsApi.get('/subscriptions/v1/applications/mobile/rndc', { timeout: 8000 });
            
            console.log("✅ Servidor alcanzable (Heartbeat OK)");
            
            // Guardamos la data para que el Home la use (Evita segunda llamada)
            setServerData(response.data); 
            setServerReachable(true);
        } catch (error) {
            console.warn("⚠️ Servidor inalcanzable:", error);
            setServerReachable(false);
        } finally {
            // Liberamos bloqueo
            isRequestingRef.current = false;
            setChecking(false);
        }
    }, [netInfo.isConnected, setServerReachable, setChecking, setServerData]);

    // Efecto 1: Reaccionar a cambios en NetInfo
    useEffect(() => {
        if (netInfo.isConnected !== null) {
            checkServer();
            
            // Si recuperamos conexión (incluso si es solo detectada por NetInfo) 
            // intentamos procesar pendientes si estamos autenticados.
            // Nota: processPendingLocations ahora verifica isServerReachable internamente.
            if (netInfo.isConnected && isAuthenticated && isHydrated) {
                console.log("[useServerConnection] 🌐 Conexión detectada y usuario autenticado. Iniciando procesamiento de pendientes...");
                EjetrackService.processPendingLocations();
            }
        }
    }, [netInfo.isConnected, checkServer, isAuthenticated, isHydrated]);

    // Efecto 2: Polling de respaldo (cada 30s) para mantener estado fresco y forzar sincronización
    useEffect(() => {
        let interval: any;
        if (netInfo.isConnected === true) {
            interval = setInterval(() => {
                checkServer();
                // Forzar intento de sincronización periódica aunque no haya cambios de red detectados,
                // solo si el usuario está autenticado y el estado hidratado.
                if (isAuthenticated && isHydrated) {
                    EjetrackService.processPendingLocations();
                }
            }, 120000);
        }
        return () => clearInterval(interval);
    }, [netInfo.isConnected, checkServer, isAuthenticated, isHydrated]);

    return {
        isConnectedToInternet: netInfo.isConnected,
        isServerReachable,
        serverData,
        isChecking, 
        recheckConnection: checkServer
    };
};