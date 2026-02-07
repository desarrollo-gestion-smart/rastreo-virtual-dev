import 'react-native-get-random-values';
import 'react-native-gesture-handler';
import { Stack, useRouter, SplashScreen, useSegments, useRootNavigationState } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { useEffect, useMemo } from 'react';
import { databaseService } from '@/database/DatabaseService';
import { 
    MD3LightTheme, 
    MD3DarkTheme, 
    PaperProvider, 
    adaptNavigationTheme 
} from 'react-native-paper';
import { 
    DarkTheme as NavigationDarkTheme, 
    DefaultTheme as NavigationDefaultTheme,
    ThemeProvider
} from '@react-navigation/native';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import { useBackgroundSync } from '@/hooks/use-background-sync';
import { useNotificationActions } from '@/hooks/useNotificationActions';
import { notificationService, setupNotificationCategories } from '@/services/NotificationService';
import { syncManager } from '@/services/SyncManager';
import { useThemeStore } from '@/store/themeStore';
// Quitamos los imports directos que registran tareas al importar para evitar bloqueos en el arranque
// import '@/services/LocationTrackingService'; 
// import '@/services/BackgroundSyncService'; 
import { BackgroundSyncService } from '@/services/BackgroundSyncService';
import notifee from '@notifee/react-native';

// No registrar aquí para evitar bloqueos en el arranque
// El registro se hará de forma dinámica cuando sea necesario o en un efecto controlado.

// Adaptamos los temas de navegación para que funcionen con Paper
const { LightTheme, DarkTheme } = adaptNavigationTheme({
    reactNavigationLight: NavigationDefaultTheme,
    reactNavigationDark: NavigationDarkTheme,
});

// Definimos los temas combinados
const CombinedDefaultTheme = {
    ...MD3LightTheme,
    ...LightTheme,
    roundness: 10,
    fonts: MD3LightTheme.fonts,
    colors: {
        ...MD3LightTheme.colors,
        ...LightTheme.colors,
        primary: '#007BFF',
        accent: '#0056b3',
        background: '#f8f9fa',
        surface: 'white',
        error: '#dc3545',
    },
};

const CombinedDarkTheme = {
    ...MD3DarkTheme,
    ...DarkTheme,
    roundness: 10,
    fonts: MD3DarkTheme.fonts,
    colors: {
        ...MD3DarkTheme.colors,
        ...DarkTheme.colors,
        primary: '#3b9eff', // Un poco más claro para mejor contraste en fondo oscuro
        accent: '#0056b3',
        background: '#121212',
        surface: '#1e1e1e',
        error: '#ff5252',
    },
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    useKeepAwake();
    const { isAuthenticated, isHydrated, hydrate: hydrateAuth, syncProgress } = useAuthStore();
    const { themeMode } = useThemeStore();
    const colorScheme = useColorScheme();

    const isDarkMode = themeMode === 'system' 
        ? colorScheme === 'dark' 
        : themeMode === 'dark';

    const theme = isDarkMode ? CombinedDarkTheme : CombinedDefaultTheme;
    // Quitamos los otros hydrates
    const router = useRouter();
    const segments = useSegments();
    const rootNavigationState = useRootNavigationState();
    useBackgroundSync();
    useNotificationActions();
    // 1. Efecto para inicializar DB y TODOS los stores relevantes

    useEffect(() => {
        let cleanupNotifications: (() => void) | undefined;

        const initializeApp = async () => {
            try {
                // Registro diferido de servicios para evitar bloqueos en el hilo principal durante el arranque
                console.log("⚙️ Registrando servicios de fondo...");
                require('@/services/LocationTrackingService');
                require('@/services/BackgroundSyncService');

                console.log("⚙️ Configurando Categorías de Notificación...");
                await setupNotificationCategories();
                
                console.log("⚙️ Inicializando Base de Datos...");
                await databaseService.init();

                console.log("⚙️ Registrando tarea de sincronización en segundo plano...");
                await BackgroundSyncService.registerSyncTask();
                
                console.log("💧 Iniciando hidratación de sesión...");
                await hydrateAuth(); 

                // Configuramos los listeners de inmediato para no perder notificaciones
                // que lleguen mientras la app se abre (cold start)
                console.log("👂 Configurando Listeners Push...");
                cleanupNotifications = notificationService.setupNotificationListeners();

            } catch (e) {
                console.error("❌ Error fatal inicializando:", e);
                // Fallback para evitar pantalla blanca eterna
                if (!useAuthStore.getState().isHydrated){
                   useAuthStore.setState({ isHydrated: true });
                }
            }
        };

        initializeApp();

        return () => {
            if (cleanupNotifications) cleanupNotifications();
        };
    }, []); // Se ejecuta solo una vez

    useEffect(() => {
        const syncUserDevice = async () => {
            // Solo procedemos si la app ya cargó (isHydrated) Y hay un usuario real (isAuthenticated)
            if (isHydrated && isAuthenticated) {
                console.log("👤 Usuario detectado/logueado. Sincronizando dispositivo...");
                
                try {
                    // A. Obtenemos el token (Si no tiene permisos, pedirá. Si ya tiene, lo recupera rápido)
                    const token = await notificationService.registerForPushNotificationsAsync();
                    
                    // B. Lo enviamos a Laravel usando tu nuevo SyncManager
                    if (token) {
                        await syncManager.registerDeviceToken(token);
                    } else {
                        console.warn("⚠️ No se pudo obtener token (Permisos denegados o emulador)");
                    }
                } catch (error) {
                    console.error("❌ Error en flujo de sincronización de token:", error);
                }
            }
        };

        syncUserDevice();
        
    }, [isHydrated, isAuthenticated]);
    // 2. Efecto para manejar la navegación
    useEffect(() => {
        console.log(`[Nav Guard Effect] isHydrated=${isHydrated}, isAuthenticated=${isAuthenticated}, syncStatus=${syncProgress.status}`);

        // SI NO ESTÁ HIDRATADO O EL NAVEGADOR NO ESTÁ LISTO, NO NAVEGAR
        if (!isHydrated || !rootNavigationState?.key) {
            console.log("[Nav Guard] Esperando hidratación o navegación ready...");
            return;
        }

        console.log("[Nav Guard] Hidratación completa y Navegación lista. Ocultando SplashScreen.");
        SplashScreen.hideAsync();

        const inAuthGroup = segments[0] === '(app)';
        const inAuthScreen = segments[0] === '(auth)';

        if (isAuthenticated) {
            console.log("[Nav Guard] Usuario AUTENTICADO.");
            if (syncProgress.status === 'syncing') {
                if (segments[1] !== 'sync') {
                    console.log("[Nav Guard] Redirigiendo a /sync...");
                    router.replace('/(app)/sync');
                }
            } else {
                 if (!inAuthGroup) {
                    console.log(`[Nav Guard] Redirigiendo a /(app)...`);
                    router.replace('/(app)' as any);
                 }
            }
        } else {
            console.log("[Nav Guard] Usuario NO AUTENTICADO.");
             if (!inAuthScreen) {
                console.log("[Nav Guard] Redirigiendo a /login...");
                router.replace('/(auth)/login');
             }
        }
    }, [isHydrated, isAuthenticated, syncProgress.status, segments, rootNavigationState?.key]);

    if (!isHydrated) {
        return null;
    }

    return (
        <SafeAreaProvider>
            <PaperProvider theme={theme}>
                <ThemeProvider value={theme}>
                    {/* Este Stack es el navegador raíz que contiene los dos grupos */}
                    <Stack screenOptions={{ headerShown: false }}>
                        {/* Grupo de Autenticación */}
                        <Stack.Screen name="(auth)" />
                        {/* Grupo de la Aplicación (Autenticado) */}
                        <Stack.Screen name="(app)" />
                    </Stack>
                </ThemeProvider>
            </PaperProvider>
        </SafeAreaProvider>
    );
}