import { useEffect, useCallback, useRef } from 'react';
import { useNetInfo } from '@react-native-community/netinfo';
import { AppsApi } from '@/api';
import { useServerStore } from '@/store/serverStore';
import { EjetrackService } from '@/services/EjetrackService';
import { useAuthStore } from '@/store/authStore';

const DELAY_AFTER_RECONNECT_MS = 1500;  // Esperar a que la red esté estable tras salir de modo avión
const AUTO_RETRY_DELAYS_MS = [3000, 8000]; // Reintentos automáticos si hay red pero servidor no responde

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

    const isRequestingRef = useRef(false);
    const wasConnectedRef = useRef<boolean | null>(null);

    const checkServer = useCallback(async () => {
        if (netInfo.isConnected === false) {
            setServerReachable(false);
            return;
        }

        const { isChecking: globalIsChecking } = useServerStore.getState();
        if (isRequestingRef.current || globalIsChecking) return;

        isRequestingRef.current = true;
        setChecking(true);

        try {
            const response = await AppsApi.get('/subscriptions/v1/applications/mobile/rndc', { timeout: 8000 });
            console.log("✅ Servidor alcanzable (Heartbeat OK)");
            setServerData(response.data);
            setServerReachable(true);
        } catch (error) {
            console.warn("⚠️ Servidor inalcanzable:", error);
            setServerReachable(false);
        } finally {
            isRequestingRef.current = false;
            setChecking(false);
        }
    }, [netInfo.isConnected, setServerReachable, setChecking, setServerData]);

    // Efecto 1: Al recuperar red (ej. salir de modo avión), esperar un poco y comprobar automáticamente
    useEffect(() => {
        const nowConnected = netInfo.isConnected === true;
        const wasConnected = wasConnectedRef.current;

        if (netInfo.isConnected === null) return;

        wasConnectedRef.current = nowConnected;

        // Transición de sin red → con red: comprobar tras un delay para que la red esté estable
        if (!wasConnected && nowConnected) {
            console.log("[useServerConnection] 🌐 Red detectada. Comprobando servidor en breve...");
            const t = setTimeout(() => {
                checkServer();
                if (isAuthenticated && isHydrated) {
                    EjetrackService.processPendingLocations();
                }
            }, DELAY_AFTER_RECONNECT_MS);
            return () => clearTimeout(t);
        }

        // Si ya teníamos red, comprobar de inmediato (ej. cambio de WiFi a datos)
        if (nowConnected) {
            checkServer();
            if (isAuthenticated && isHydrated) {
                EjetrackService.processPendingLocations();
            }
        } else {
            setServerReachable(false);
        }
    }, [netInfo.isConnected, checkServer, isAuthenticated, isHydrated]);

    // Efecto 2: Con red pero servidor no alcanzable → reintentos automáticos (sin tocar "Reintentar")
    useEffect(() => {
        if (netInfo.isConnected !== true || isServerReachable) return;

        const timeouts: ReturnType<typeof setTimeout>[] = [];
        AUTO_RETRY_DELAYS_MS.forEach((delayMs, i) => {
            const t = setTimeout(() => {
                const { isServerReachable: current } = useServerStore.getState();
                if (current) return;
                console.log(`[useServerConnection] 🔄 Reintento automático ${i + 1}/${AUTO_RETRY_DELAYS_MS.length}...`);
                checkServer();
            }, delayMs);
            timeouts.push(t);
        });

        return () => timeouts.forEach((id) => clearTimeout(id));
    }, [netInfo.isConnected, isServerReachable, checkServer]);

    // Efecto 3: Polling de respaldo cada 2 min cuando hay red
    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | undefined;
        if (netInfo.isConnected === true) {
            interval = setInterval(() => {
                checkServer();
                if (isAuthenticated && isHydrated) {
                    EjetrackService.processPendingLocations();
                }
            }, 120000);
        }
        return () => (interval ? clearInterval(interval) : undefined);
    }, [netInfo.isConnected, checkServer, isAuthenticated, isHydrated]);

    return {
        isConnectedToInternet: netInfo.isConnected,
        isServerReachable,
        serverData,
        isChecking,
        recheckConnection: checkServer
    };
};