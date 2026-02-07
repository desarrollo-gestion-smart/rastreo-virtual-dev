import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Image, TouchableOpacity, Platform, Linking, Dimensions, Alert } from 'react-native';
import { Text, Card, useTheme, Icon, Banner } from 'react-native-paper';
import { useDeviceStore } from '@/store/deviceStore';
import { LocationTrackingService } from '@/services/LocationTrackingService';
import { useCompanyStore } from '@/store/companyStore';
import { useTripStore } from '@/store/tripStore';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import * as Application from 'expo-application';
import { useServerConnection } from '@/hooks/use-server-connection';

const { width } = Dimensions.get('window');

// Componente principal de la pantalla de inicio
const HomeScreen = () => {
    const theme = useTheme();
    const router = useRouter();
    const { isConnectedToInternet, isServerReachable, serverData, isChecking, recheckConnection } = useServerConnection();
    const currentDevice = useDeviceStore((state) => state.currentDevice);
    const currentCompany = useCompanyStore((state) => state.currentCompany);
    const { isTrackingActive, setIsTrackingActive, hydrate: hydrateTrip } = useTripStore();
    const vehicleImage = currentDevice?.image_link || `https://via.placeholder.com/150/${theme.colors.primary.substring(1)}/FFFFFF?text=${currentDevice?.plate || '...'}`;

    // Estado para la actualización
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [latestVersionStr, setLatestVersionStr] = useState('');

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
        
        // Verificar permiso de ahorro de datos al iniciar
        if (Platform.OS === 'android') {
            LocationTrackingService.checkDataSaverPermission();
        }
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
        } else {
            await LocationTrackingService.startTracking();
            await setIsTrackingActive(true);
        }
    };
    const showOfflineBanner = isConnectedToInternet === false;
    const showPartialConnectionBanner = isConnectedToInternet === true && isServerReachable === false;
    const isDark = theme.dark;

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

                            <TouchableOpacity style={styles.changeVehicleButtonShadow} onPress={navigateToChangeVehicle}>
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

                {/* --- NUEVA CUADRÍCULA DE BOTONES --- */}
                <View style={styles.gridContainer}>


                    {/* 4. MIS VIAJES (Naranja - Reemplaza estadísticas) */}
                    <TouchableOpacity  onPress={handleToggleTracking} activeOpacity={0.9} style={{ width: '100%' }}>
                        <LinearGradient
                            colors={isTrackingActive
                                ? ['#ff5252', '#d32f2f'] // Rojo para finalizar
                                : ['#11ff00', '#008f2b'] // Naranja para iniciar (o fucsia si prefieres: ['#E91E63', '#C2185B'])
                            }
                            style={styles.actionGradient}
                        >
                            <Icon
                                source={isTrackingActive ? "stop-circle-outline" : "play-circle-outline"}
                                size={60}
                                color="#fff"
                            />
                            <Text style={styles.actionLabel}>
                                {isTrackingActive ? 'Finalizar Ruta' : 'Iniciar Ruta'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
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

    // --- NUEVOS ESTILOS GRID (CUADRÍCULA) ---
    gridContainer: {
        marginTop: 10,
    },

    gridGradient: {
        flex: 1,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10,
    },
    gridLabel: {
        color: 'white',
        fontSize: 17,
        fontWeight: 'bold',
        marginTop: 12,
        textAlign: 'center',
    },
    actionContainer: {
        marginTop: 10,
        alignItems: 'center',
    },
    actionButton: {
        width: '100%',
        height: 180,
        borderRadius: 20,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    actionGradient: {
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40, // Aumentado para dar más presencia al ser botón único
    },
    actionLabel: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 15,
        textAlign: 'center',
    },
});

export default HomeScreen;
