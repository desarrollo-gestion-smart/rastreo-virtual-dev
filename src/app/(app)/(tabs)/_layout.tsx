import React, {useState} from 'react';
import {Tabs, useNavigation, useRouter} from 'expo-router';
// Importamos Portal
import {Appbar, useTheme, Portal, Modal} from 'react-native-paper';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Platform, TouchableOpacity, Alert, StyleSheet, View, useColorScheme} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Image} from 'expo-image';
import {useAuthStore} from '@/store/authStore';
import {useThemeStore} from '@/store/themeStore';
import {DrawerNavigationProp} from '@react-navigation/drawer';
import {StatusBar} from 'expo-status-bar';
import {BottomTabHeaderProps} from '@react-navigation/bottom-tabs';

// Importamos el nuevo panel izquierdo
import UserMenuPanel from '@/components/user-menu-panel';

// Tipos de navegación (sin cambios)
type RootDrawerParamList = { '(tabs)': undefined; };
type DrawerNavProp = DrawerNavigationProp<RootDrawerParamList>;

// --- Componente CustomHeader ---
function CustomHeader(props: BottomTabHeaderProps) {
    const theme = useTheme();
    const {top} = useSafeAreaInsets();
    const currentEmployee = useAuthStore((state) => state.currentEmployee);
    const navigation = useNavigation<DrawerNavProp>();
    const { themeMode, setThemeMode } = useThemeStore();

    // Calculamos si está en modo oscuro para el icono
    const colorScheme = useColorScheme();
    const isDarkMode = themeMode === 'system' ? colorScheme === 'dark' : themeMode === 'dark';

    // Obtenemos la prop personalizada para abrir el menú izquierdo
    const {onOpenLeftMenu} = props.options as any;

    const handleMenu = () => {
        onOpenLeftMenu(); // Llama a la función del layout padre
    };
    const handleThemeToggle = () => {
        setThemeMode(isDarkMode ? 'light' : 'dark');
    };
    const handleProfile = () => {
        navigation.openDrawer(); // Abre el Drawer de la DERECHA
    };
    const avatarUrl = (typeof currentEmployee?.avatar === 'object' && currentEmployee?.avatar?.url)
        ? currentEmployee.avatar.url
        : 'https://via.placeholder.com/50/FFFFFF/000000?text=E';

    return (
        <View style={[styles.headerContainer]}>
            <LinearGradient
                colors={isDarkMode ? ['#1a1a1a', '#2c2c2c'] : ['#3a47d5', '#0072ff']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={styles.gradient}
            >
                <Appbar.Header
                    style={styles.appbar}
                    statusBarHeight={top}
                >
                    {/* Este botón ahora abre el Menú Izquierdo (Modal) */}
                    <Appbar.Action icon="menu" color="white" onPress={handleMenu}/>
                    <Appbar.Content title={props.options.title || props.route.name} color="white"
                                    titleStyle={styles.headerTitle}/>
                    <Appbar.Action
                        icon={isDarkMode ? "weather-night" : "weather-sunny"}
                        color="white"
                        onPress={handleThemeToggle}
                    />
                    {/* Este botón abre el Menú Derecho (Drawer) */}
                    <TouchableOpacity onPress={handleProfile} style={styles.avatarTouchable}>
                        <Image
                            style={styles.avatarImage}
                            source={{uri: avatarUrl}}
                            placeholder={'https://via.placeholder.com/50/FFFFFF/000000?text=E'}
                            contentFit="cover"
                            transition={500}
                        />
                    </TouchableOpacity>
                </Appbar.Header>
            </LinearGradient>
        </View>
    );
}

// --- Fin CustomHeader ---


// --- Layout principal de las pestañas ---
export default function TabLayout() {
    const theme = useTheme();
    const {bottom} = useSafeAreaInsets();
    const router = useRouter();
    // Estado para el menú izquierdo
    const [mainMenuVisible, setMainMenuVisible] = useState(false);
    const onOpenLeftMenu = () => setMainMenuVisible(true);
    const onCloseLeftMenu = () => setMainMenuVisible(false);

    const { themeMode } = useThemeStore();
    const colorScheme = useColorScheme();
    const isDarkMode = themeMode === 'system' ? colorScheme === 'dark' : themeMode === 'dark';

    // @ts-ignore
    return (
        <>
            <StatusBar style="light"/>
            <Tabs
                screenOptions={{
                    // Pasamos la función de abrir al header de cada pestaña
                    header: (props) => <CustomHeader {...props} options={{...props.options, onOpenLeftMenu}}/>,
                    tabBarActiveTintColor: 'white',
                    tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.6)',
                    tabBarStyle: {
                        borderTopWidth: 0,
                        elevation: 0,
                        height: 60,
                        marginBottom: bottom,
                        paddingTop: 5,
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        overflow: 'hidden',
                        backgroundColor: 'transparent',
                    },
                    tabBarLabelStyle: {
                        fontWeight: 'bold',
                        fontSize: 11,
                    },
                    tabBarBackground: () => (
                        <LinearGradient
                            colors={isDarkMode ? ['#1a1a1a', '#2c2c2c'] : ['#3a47d5', '#0072ff']}
                            style={[StyleSheet.absoluteFillObject, styles.gradientTab]}
                            start={{x: 0, y: 0}}
                            end={{x: 1, y: 0}}
                        />
                    ),
                }}
            >
                {/* Pantallas de Tabs (sin cambios) */}
                <Tabs.Screen
                    name="index"
                    options={{title: 'Rutas',
                        tabBarIcon: ({color, size}) => (
                            <Appbar.Action icon="home" color={color} size={size + 4} style={styles.tabBarIconStyle}/>)
                    }}
                />

                <Tabs.Screen

                    name="locations"
                    options={{
                        href: null,
                        title: 'Posiciones',
                        tabBarIcon: ({color, size}) => (
                            <Appbar.Action icon="map-marker" color={color} size={size + 4} style={styles.tabBarIconStyle}/>
                        )
                    }}
                />

                <Tabs.Screen
                    name="profile"
                    options={{title: 'Perfil',
                        tabBarIcon: ({color, size}) => (<Appbar.Action icon="account" color={color} size={size + 4}
                                                                       style={styles.tabBarIconStyle}/>)
                    }}
                />

                <Tabs.Screen
                    name="logout"
                    options={{
                        title: 'Cerrar Sesión',
                        tabBarIcon: ({color, size}) => (
                            <Appbar.Action icon="logout" color={color} size={size + 4} style={styles.tabBarIconStyle}/>
                        )
                    }}
                    listeners={{
                        tabPress: (e) => {
                            // 1. Prevenir la navegación default
                            e.preventDefault();

                            // 2. Definir la función de logout asíncrona
                            const handleLogout = async () => {
                                try {
                                    // Llama a la función de logout de tu store (asumiendo que es async)
                                    await useAuthStore.getState().logout();
                                    // Redirige a /login y limpia la pila de navegación
                                    router.replace("/login");
                                } catch (error) {
                                    console.error("Error al cerrar sesión:", error);
                                    Alert.alert("Error", "No se pudo cerrar la sesión.");
                                }
                            };

                            // 3. Mostrar la alerta de confirmación
                            Alert.alert(
                                "Cerrar Sesión",
                                "¿Estás seguro?",
                                [
                                    {text: "Cancelar", style: "cancel"},
                                    {text: "Sí", onPress: handleLogout} // <-- Llamar a la nueva función
                                ]
                            );
                        },
                    }}
                />
            </Tabs>

            {/* Portal para el Menú Izquierdo */}
            <Portal>
                <Modal 
                    visible={mainMenuVisible} 
                    onDismiss={onCloseLeftMenu}
                    contentContainerStyle={{ flex: 1, width: '80%' }}
                >
                    <UserMenuPanel 
                        navigation={{ 
                            closeDrawer: onCloseLeftMenu,
                            openDrawer: () => {
                                onCloseLeftMenu();
                            }
                        }} 
                    />
                </Modal>
            </Portal>
        </>
    );
}

// --- Estilos ---
const styles = StyleSheet.create({
    headerContainer: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 5,
        backgroundColor: 'transparent',
    },
    gradient: {
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        overflow: 'hidden',
    },
    gradientTab: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
    },
    appbar: {
        backgroundColor: 'transparent',
        elevation: 0,
        shadowOpacity: 0,
    },
    headerTitle: {
        fontWeight: 'bold',
        fontSize: 20,
    },
    avatarTouchable: {
        marginRight: 15,
        marginLeft: 5,
    },
    avatarImage: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    tabBarIconStyle: {
        marginBottom: -5,
        padding: 0,
    },
});
