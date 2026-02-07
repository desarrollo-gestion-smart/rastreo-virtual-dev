import 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { useTheme } from 'react-native-paper';
// Importamos nuestro contenido de drawer personalizado
import UserMenuPanel from '@/components/user-menu-panel';
import { useAuthStore } from '@/store/authStore';

// 🔔 NOTIFICACIONES 1: Importamos el handler de background (Se registra solo al importar)
// Esto permite que el botón "Pausar" funcione aunque la app esté cerrada.
import '@/utils/notificationBackgroundHandler';

// 🔔 NOTIFICACIONES 2: Importamos el hook de acciones UI
import { useNotificationActions } from '@/hooks/useNotificationActions';

export default function AppLayout() {
    const { isAuthenticated } = useAuthStore();
    const theme = useTheme();

    // 🔔 NOTIFICACIONES 3: Activamos el listener de acciones de primer plano
    // Esto maneja el botón "Finalizar" que abre la app.
    useNotificationActions();

    return (
        <Drawer
            drawerContent={(props) => <UserMenuPanel {...props} />}
            screenOptions={{
                headerShown: false,
                drawerPosition: 'right', // Panel a la derecha
                drawerStyle: {
                    backgroundColor: theme.colors.surface,
                },
                swipeEnabled: isAuthenticated,
            }}
        >
            {/* Grupo de pestañas principal */}
            <Drawer.Screen
                name="(tabs)"
                options={{
                    drawerItemStyle: { height: 0, display: 'none' },
                }}
            />
            {/* Pantalla de Sincronización */}
            <Drawer.Screen
                name="sync"
                options={{
                    drawerItemStyle: { height: 0, display: 'none' },
                    headerShown: false,
                    swipeEnabled: false,
                }}
            />
            {/* Grupo de preguntas */}


        </Drawer>
    );
}