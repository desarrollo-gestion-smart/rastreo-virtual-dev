import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Image, TouchableOpacity, Platform, Linking, Dimensions, Alert, Modal, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Text, Card, useTheme, Icon, Banner, ActivityIndicator } from 'react-native-paper';
import { useDeviceStore } from '@/store/deviceStore';
import { LocationTrackingService } from '@/services/LocationTrackingService';
import { prepareForTracking, getLocationPermissionStatus, openLocationPermissionDialog } from '@/services/LocationPermissionFlow';
import { openAppSettingsForBattery, markBatteryModalShown, hasShownBatteryModal, isBatteryRestricted, clearBatterySettingsTrust } from '@/services/OptimizationSetupService';
import { useCompanyStore } from '@/store/companyStore';
import { useTripStore } from '@/store/tripStore';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as Application from 'expo-application';
import { useServerConnection } from '@/hooks/use-server-connection';
import { useAuthStore } from '@/store/authStore';
import { pendingLocationService } from '@/services/PendingLocationService';
import { EjetrackService } from '@/services/EjetrackService';

const { width } = Dimensions.get('window');

let hasRequestedStartupLocationPermissions = false;

// Componente principal de la pantalla de inicio
const HomeScreen = () => {
    const theme = useTheme();
    const router = useRouter();
    const { isConnectedToInternet, isServerReachable, serverData, isChecking, recheckConnection } = useServerConnection();
    const notificationPermissionRequested = useAuthStore((s) => s.notificationPermissionRequested);
    const currentDevice = useDeviceStore((state) => state.currentDevice);
    const currentCompany = useCompanyStore((state) => state.currentCompany);
    const { isTrackingActive, setIsTrackingActive, hydrate: hydrateTrip } = useTripStore();
    const vehicleImage = currentDevice?.image_link || `https://via.placeholder.com/150/${theme.colors.primary.substring(1)}/FFFFFF?text=${currentDevice?.plate || '...'}`;

    // Estado para la actualización
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [latestVersionStr, setLatestVersionStr] = useState('');
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [showBatteryModal, setShowBatteryModal] = useState(false);
    const [showPermissionsRequiredModal, setShowPermissionsRequiredModal] = useState(false);
    const [isStartingTracking, setIsStartingTracking] = useState(false);
    const [isFinishingWithPending, setIsFinishingWithPending] = useState(false);

    // Mostrar modal de ubicación solo después de que se hayan pedido las notificaciones
    useEffect(() => {
        const checkAndShowPermissionModal = async () => {
            if (!notificationPermissionRequested || hasRequestedStartupLocationPermissions) return;
            const status = await getLocationPermissionStatus();
            if (status !== 'granted_background') {
                hasRequestedStartupLocationPermissions = true;
                setShowPermissionModal(true);
            }
        };
        checkAndShowPermissionModal();
    }, [notificationPermissionRequested]);

    const handlePermissionModalAccept = async () => {
        setShowPermissionModal(false);
        const result = await prepareForTracking();
    };

    const handlePermissionModalSkip = () => {
        setShowPermissionModal(false);
    };

    const handleBatteryModalConfigurar = async () => {
        setShowBatteryModal(false);
        await markBatteryModalShown();
        await openAppSettingsForBattery();
    };

    const handleBatteryModalSkip = async () => {
        await markBatteryModalShown();
        setShowBatteryModal(false);
    };

    useEffect(() => {
        const checkVersionData = async () => {
            if (!serverData || !serverData.version) return;

            try {
                const currentBuildNumber = Application.nativeBuildVersion || '0';
                const remoteVersionCode = parseInt(serverData.version, 10);
                const currentVersionCode = parseInt(currentBuildNumber, 10);

                console.log(`[Update Check] Local: ${currentVersionCode}, Remoto: ${remoteVersionCode}`);

                if (remoteVersionCode > currentVersionCode) {
                    setLatestVersionStr(String(remoteVersionCode));
                    setUpdateAvailable(true);
                }
            } catch (error) {
                console.error("Error procesando versión:", error);
            }
        };

        checkVersionData();
    }, [serverData]);

    // --- NAVEGACIÓN ---
    const navigateToChangeVehicle = () => router.push('/(app)/change-vehicle');


    const handleUpdateApp = () => {
        const androidPackageName = 'com.ejesatelital.rndc';
        const iosAppId = 'com.ejesatelital.rndc';

        if (Platform.OS === 'android') {
            Linking.openURL(`market://details?id=${androidPackageName}`);
        } else {
            Linking.openURL(`itms-apps://itunes.apple.com/app/id${iosAppId}`);
        }
    };
    const handleToggleTracking = async () => {
        if (isTrackingActive) {
            const pendingCount = await pendingLocationService.getPendingCount();
            if (pendingCount > 0) {
                setIsFinishingWithPending(true);
                try {
                    let count = pendingCount;
                    const maxAttempts = 50;
                    let attempts = 0;
                    while (count > 0 && attempts < maxAttempts) {
                        await EjetrackService.processPendingLocations(true);
                        await new Promise((r) => setTimeout(r, 1500));
                        count = await pendingLocationService.getPendingCount();
                        attempts++;
                    }
                } finally {
                    await LocationTrackingService.stopTracking();
                    await setIsTrackingActive(false);
                    setIsFinishingWithPending(false);
                }
            } else {
                Alert.alert(
                    "Finalizar Ruta",
                    "¿Estás seguro de que deseas finalizar el seguimiento de la ruta?",
                    [
                        { text: "Cancelar", style: "cancel" },
                        {
                            text: "Sí, finalizar",
                            onPress: async () => {
                                await LocationTrackingService.stopTracking();
                                await setIsTrackingActive(false);
                            },
                            style: "destructive"
                        }
                    ]
                );
            }
        } else {
            setIsStartingTracking(true);
            try {
                const result = await prepareForTracking();
                if (result !== 'ready') {
                    if (result === 'needs_settings' && Platform.OS === 'android') {
                        const alreadyShown = await hasShownBatteryModal();
                        if (!alreadyShown) {
                            setShowBatteryModal(true);
                        } else {
                            setShowPermissionsRequiredModal(true);
                        }
                    }
                    return;
                }
                if (Platform.OS === 'android' && (await isBatteryRestricted())) {
                }
                await LocationTrackingService.startTracking();
                await setIsTrackingActive(true);
                await clearBatterySettingsTrust();
            } finally {
                setIsStartingTracking(false);
            }
        }
    };
    const showOfflineBanner = isConnectedToInternet === false;
    const showPartialConnectionBanner = isConnectedToInternet === true && isServerReachable === false;
    const isDark = theme.dark;

    // Animaciones del botón Iniciar/Finalizar Ruta
    const buttonScale = useSharedValue(1);
    const iconPulse = useSharedValue(1);
    const buttonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }],
    }));
    const iconAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: iconPulse.value }],
    }));
    useEffect(() => {
        if (isTrackingActive) {
            iconPulse.value = withRepeat(
                withSequence(
                    withTiming(1.06, { duration: 800 }),
                    withTiming(1, { duration: 800 })
                ),
                -1,
                true
            );
        } else {
            iconPulse.value = withTiming(1, { duration: 200 });
        }
    }, [isTrackingActive]);

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <StatusBar style="light" />
            {/* BANNERS DE CONEXIÓN */}
            <Banner
                visible={showOfflineBanner}
                icon={({ size }) => <Icon source="wifi-off" size={size} color={theme.colors.error} />}
                style={{ backgroundColor: theme.colors.errorContainer }}
                actions={[]}
            >
                No hay conexión a internet. Modo offline activo.
            </Banner>

            <Banner
                visible={showPartialConnectionBanner}
                icon={({ size }) => <Icon source="server-network-off" size={size} color="#E65100" />}
                style={{ backgroundColor: theme.dark ? '#3e2723' : '#FFF3E0' }}
                actions={[
                    {
                        label: isChecking ? 'Verificando...' : 'Reintentar conexión',
                        onPress: recheckConnection,
                        loading: isChecking,
                        textColor: theme.dark ? '#ffccbc' : '#E65100'
                    }
                ]}
            >
                <Text style={{ color: theme.dark ? '#ffccbc' : '#E65100' }}>
                    Conexión inestable. Tienes señal, pero no logramos contactar al servidor. Los datos se guardarán localmente.
                </Text>
            </Banner>

            <Banner
                visible={updateAvailable}
                actions={[
                    { label: 'Actualizar ahora', onPress: handleUpdateApp, textColor: theme.dark ? theme.colors.primary : undefined },
                    { label: 'Más tarde', onPress: () => setUpdateAvailable(false), textColor: theme.dark ? theme.colors.onSurfaceVariant : undefined },
                ]}
                icon={({ size }) => <Icon source="cloud-download" size={size} color={theme.colors.primary} />}
                style={{ backgroundColor: theme.dark ? '#1a237e' : '#E3F2FD' }}
            >
                <Text style={{ color: theme.dark ? '#c5cae9' : undefined }}>
                    ¡Nueva versión disponible! La versión {latestVersionStr} está lista.
                </Text>
            </Banner>

            <ScrollView style={styles.container}>
                {/* TARJETA DE VEHÍCULO */}
                <Card style={[styles.vehicleCard, { backgroundColor: theme.colors.surface }]}>
                    <LinearGradient
                        colors={theme.dark ? ['#333', '#444'] : ['#0085FF', '#0058D6']}
                        style={styles.vehicleCardGradient}
                    >
                        <Card.Content style={styles.vehicleCardContent}>
                            <Image source={{ uri: vehicleImage }} style={styles.vehicleImage} />
                            <Text style={styles.vehiclePlate}>{currentDevice?.name || 'Sin Vehículo'}</Text>
                            <Text style={styles.vehicleCompany}>{currentCompany?.name || 'Sin Empresa'}</Text>

                            <TouchableOpacity
                                style={[styles.changeVehicleButtonShadow, isTrackingActive && { opacity: 0.5 }]}
                                onPress={isTrackingActive ? undefined : navigateToChangeVehicle}
                                disabled={isTrackingActive}
                            >
                                <LinearGradient
                                    colors={['#00A2FF', '#007AFF']}
                                    start={{ x: 0, y: 0.5 }}
                                    end={{ x: 1, y: 0.5 }}
                                    style={styles.changeVehicleButtonGradient}
                                >
                                    <Icon source="magnify" size={20} color="#fff" />
                                    <Text style={styles.changeVehicleButtonLabel}>Cambiar Vehículo</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </Card.Content>
                    </LinearGradient>
                </Card>

                {/* Botón Iniciar / Finalizar Ruta */}
                <View style={styles.gridContainer}>
                    <Pressable
                        onPress={handleToggleTracking}
                        onPressIn={() => { if (!isFinishingWithPending) buttonScale.value = withSpring(0.96, { damping: 15, stiffness: 400 }); }}
                        onPressOut={() => { buttonScale.value = withSpring(1); }}
                        style={styles.actionButtonWrapper}
                        disabled={isStartingTracking || isFinishingWithPending}
                    >
                        <Animated.View style={buttonAnimatedStyle}>
                            <Card style={[styles.actionCard, { backgroundColor: 'transparent', elevation: 6, shadowOpacity: 0.2 }]}>
                                <LinearGradient
                                    colors={isTrackingActive
                                        ? ['#FF6B6B', '#EE5A5A', '#C0392B']
                                        : ['#00B894', '#00A085', '#00897B']
                                    }
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.actionGradient}
                                >
                                    {isStartingTracking ? (
                                        <>
                                            <ActivityIndicator size="small" color="rgba(255,255,255,0.95)" style={{ marginBottom: 10 }} />
                                            <Text style={styles.actionLabel}>Iniciando...</Text>
                                        </>
                                    ) : isFinishingWithPending ? (
                                        <>
                                            <ActivityIndicator size="small" color="rgba(255,255,255,0.95)" style={{ marginBottom: 10 }} />
                                            <Text style={styles.actionLabel}>Enviando puntos pendientes, aguarde...</Text>
                                        </>
                                    ) : (
                                        <>
                                            <Animated.View style={[styles.actionIconCircle, iconAnimatedStyle]}>
                                                <Icon
                                                    source={isTrackingActive ? "stop-circle" : "play-circle"}
                                                    size={36}
                                                    color="rgba(255,255,255,0.95)"
                                                />
                                            </Animated.View>
                                            <Text style={styles.actionLabel}>
                                                {isTrackingActive ? 'Finalizar Ruta' : 'Iniciar Ruta'}
                                            </Text>
                                            <Text style={styles.actionSublabel}>
                                                {isTrackingActive ? 'Dejar de transmitir ubicación' : 'Empezar a transmitir ubicación'}
                                            </Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </Card>
                        </Animated.View>
                    </Pressable>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Modal de permisos de ubicación */}
            <Modal
                visible={showPermissionModal}
                transparent
                animationType="fade"
                onRequestClose={handlePermissionModalSkip}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={handlePermissionModalSkip}
                >
                    <Pressable
                        style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <LinearGradient
                            colors={isDark ? ['#1a237e', '#3949ab'] : ['#3a47d5', '#0072ff']}
                            style={styles.modalHeader}
                        >
                            <Icon source="map-marker-radius" size={48} color="#fff" />
                            <Text variant="titleLarge" style={styles.modalTitle}>
                                Permisos de ubicación
                            </Text>
                        </LinearGradient>

                        <View style={styles.modalBody}>
                            <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, marginBottom: 16, textAlign: 'center' }}>
                                Para registrar tu ruta necesitamos acceso a tu ubicación. A continuación aparecerán dos diálogos del sistema.
                            </Text>
                            <View style={[styles.modalStep, { backgroundColor: theme.colors.surfaceVariant }]}>
                                <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>
                                    1.er diálogo
                                </Text>
                                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                    Selecciona <Text style={{ fontWeight: '700' }}>"Mientras usas la app"</Text>
                                </Text>
                            </View>
                            <View style={[styles.modalStep, { backgroundColor: theme.colors.surfaceVariant }]}>
                                <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>
                                    2.º diálogo
                                </Text>
                                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                    Selecciona <Text style={{ fontWeight: '700' }}>"Permitir siempre"</Text> para que el rastreo funcione con la pantalla apagada.
                                </Text>
                            </View>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                onPress={handlePermissionModalAccept}
                                activeOpacity={0.8}
                                style={styles.modalPrimaryButton}
                            >
                                <LinearGradient
                                    colors={['#00C853', '#008f2b']}
                                    style={styles.modalPrimaryButtonGradient}
                                >
                                    <Icon source="check-circle" size={22} color="#fff" />
                                    <Text style={styles.modalPrimaryButtonText}>Dar permisos</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                            <Pressable onPress={handlePermissionModalSkip} style={styles.modalSkipButton}>
                                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                    Ahora no
                                </Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Modal permisos requeridos (Iniciar ruta sin permiso background) */}
            <Modal
                visible={showPermissionsRequiredModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowPermissionsRequiredModal(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setShowPermissionsRequiredModal(false)}
                >
                    <Pressable
                        style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <LinearGradient
                            colors={isDark ? ['#1a237e', '#3949ab'] : ['#3a47d5', '#0072ff']}
                            style={styles.modalHeader}
                        >
                            <Icon source="map-marker-radius" size={48} color="#fff" />
                            <Text variant="titleLarge" style={styles.modalTitle}>
                                Permiso requerido
                            </Text>
                        </LinearGradient>

                        <View style={styles.modalBody}>
                            <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, marginBottom: 16, textAlign: 'center' }}>
                                Para iniciar la ruta necesitamos acceso a tu ubicación en todo momento.
                            </Text>
                            <View style={[styles.modalStep, { backgroundColor: theme.colors.surfaceVariant }]}>
                                <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>
                                    Qué hacer
                                </Text>
                                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                    Ve a Ajustes → Permisos de la app y cambia la ubicación a <Text style={{ fontWeight: '700' }}>"Permitir todo el tiempo"</Text> para que el rastreo funcione correctamente.
                                </Text>
                            </View>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                onPress={async () => {
                                    setShowPermissionsRequiredModal(false);
                                    await openLocationPermissionDialog();
                                }}
                                activeOpacity={0.8}
                                style={styles.modalPrimaryButton}
                            >
                                <LinearGradient
                                    colors={['#00C853', '#008f2b']}
                                    style={styles.modalPrimaryButtonGradient}
                                >
                                    <Icon source="cog" size={22} color="#fff" />
                                    <Text style={styles.modalPrimaryButtonText}>Ir a Ajustes</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                            <Pressable
                                onPress={() => setShowPermissionsRequiredModal(false)}
                                style={styles.modalSkipButton}
                            >
                                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                    Entendido
                                </Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Modal de restricción de batería (Android) */}
            <Modal
                visible={showBatteryModal}
                transparent
                animationType="fade"
                onRequestClose={handleBatteryModalSkip}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={handleBatteryModalSkip}
                >
                    <Pressable
                        style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        <LinearGradient
                            colors={isDark ? ['#e65100', '#ff6f00'] : ['#ff6f00', '#ff9800']}
                            style={styles.modalHeader}
                        >
                            <Icon source="battery-sync" size={48} color="#fff" />
                            <Text variant="titleLarge" style={styles.modalTitle}>
                                Quitar restricción de batería
                            </Text>
                        </LinearGradient>

                        <View style={styles.modalBody}>
                            <Text variant="bodyLarge" style={{ color: theme.colors.onSurface, marginBottom: 16, textAlign: 'center' }}>
                                Para que la ubicación siga enviándose con la pantalla apagada, necesitamos que quites la restricción de batería de la app.
                            </Text>
                            <View style={[styles.modalStep, { backgroundColor: theme.colors.surfaceVariant }]}>
                                <Text variant="labelLarge" style={{ color: theme.colors.primary, marginBottom: 4 }}>
                                    Qué hacer
                                </Text>
                                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                    1. Toca <Text style={{ fontWeight: '700' }}>"Batería"</Text> o "Uso de batería"{'\n'}
                                    2. Selecciona <Text style={{ fontWeight: '700' }}>"Sin restricciones"</Text> o "No restringir"
                                </Text>
                            </View>
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                onPress={handleBatteryModalConfigurar}
                                activeOpacity={0.8}
                                style={styles.modalPrimaryButton}
                            >
                                <LinearGradient
                                    colors={['#ff9800', '#f57c00']}
                                    style={styles.modalPrimaryButtonGradient}
                                >
                                    <Icon source="battery-check" size={22} color="#fff" />
                                    <Text style={styles.modalPrimaryButtonText}>Ir a Ajustes</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                            <Pressable onPress={handleBatteryModalSkip} style={styles.modalSkipButton}>
                                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                                    Ahora no
                                </Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 15,
        paddingTop: 20,
    },
    // --- ESTILOS DE TARJETA VEHÍCULO ---
    vehicleCard: {
        marginBottom: 25,
        borderRadius: 20,
        elevation: 6,
        backgroundColor: 'transparent',
    },
    vehicleCardGradient: {
        borderRadius: 20,
    },
    vehicleCardContent: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    vehicleImage: {
        width: 90,
        height: 90,
        borderRadius: 45,
        marginBottom: 10,
        backgroundColor: 'white',
        borderWidth: 3,
        borderColor: 'rgba(255, 255, 255, 0.8)',
    },
    vehiclePlate: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 2,
    },
    vehicleCompany: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    changeVehicleButtonShadow: {
        borderRadius: 50,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        width: '80%',
        marginTop: 20,
    },
    changeVehicleButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 50,
    },
    changeVehicleButtonLabel: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
        marginLeft: 8,
    },

    gridContainer: {
        marginTop: 10,
    },
    actionButtonWrapper: {
        width: '100%',
    },
    actionCard: {
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    actionGradient: {
        borderRadius: 16,
        paddingVertical: 18,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.22)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    actionLabel: {
        color: 'white',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.3,
        textAlign: 'center',
    },
    actionSublabel: {
        color: 'rgba(255,255,255,0.88)',
        fontSize: 12,
        marginTop: 4,
        fontWeight: '500',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    modalHeader: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 20,
    },
    modalTitle: {
        color: '#fff',
        fontWeight: '700',
        marginTop: 12,
    },
    modalBody: {
        padding: 20,
    },
    modalStep: {
        padding: 14,
        borderRadius: 12,
        marginBottom: 12,
    },
    modalActions: {
        padding: 20,
        paddingTop: 8,
    },
    modalPrimaryButton: {
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 12,
    },
    modalPrimaryButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        gap: 8,
    },
    modalPrimaryButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    modalSkipButton: {
        alignItems: 'center',
        paddingVertical: 8,
    },
});

export default HomeScreen;
