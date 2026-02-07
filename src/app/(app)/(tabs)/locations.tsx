import React, { useEffect, useCallback, useState, useRef } from 'react';
import { View, StyleSheet, RefreshControl } from 'react-native';
import { Text, Card, IconButton, useTheme, Chip, ActivityIndicator, Divider, FAB, Menu, Portal, Snackbar } from 'react-native-paper';
import { locationHistoryService, LocationHistoryEntry } from '@/services/LocationHistoryService';
import { pendingLocationService } from '@/services/PendingLocationService';
import { EjetrackService } from '@/services/EjetrackService';
import { TrackingStressTest } from '@/utils/TrackingStressTest';
import { useLocationStore } from '@/store/locationStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FlashList } from '@shopify/flash-list';
import { useServerConnection } from '@/hooks/use-server-connection';

export default function LocationsScreen() {
    const { locations, loading, setLoading } = useLocationStore();
    const { isConnectedToInternet, isServerReachable, isChecking: isNetworkChecking } = useServerConnection();
    const [refreshing, setRefreshing] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<number | null>(null);
    const [menuVisible, setMenuVisible] = useState(false);
    const [snackbarVisible, setSnackbarVisible] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [stressLoading, setStressLoading] = useState(false);
    
    const theme = useTheme();
    const refreshInterval = useRef<NodeJS.Timeout | null>(null);

    const loadData = useCallback(async () => {
        const [count] = await Promise.all([
            pendingLocationService.getPendingCount(),
            locationHistoryService.getAllHistory(200)
        ]);
        setPendingCount(count);
        setIsSyncing(EjetrackService.getSyncStatus());
        setLastSync(EjetrackService.getLastSyncTimestamp());
    }, []);

    const loadHistory = useCallback(async () => {
        setLoading(true);
        await loadData();
        setLoading(false);
    }, [setLoading, loadData]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    }, [loadData]);

    useEffect(() => {
        loadHistory();
        
        // Polling para telemetría en tiempo real
        refreshInterval.current = setInterval(loadData, 3000);
        
        return () => {
            if (refreshInterval.current) clearInterval(refreshInterval.current);
        };
    }, [loadHistory, loadData]);

  /*  const handleStressTest = async () => {
        setMenuVisible(false);
        setStressLoading(true);
        setSnackbarMessage('Ejecutando prueba de estrés: 100 puntos...');
        setSnackbarVisible(true);
        
        try {
            await TrackingStressTest.runStress(100);
            setSnackbarMessage('Prueba de estrés completada.');
            await loadData();
        } catch (error) {
            setSnackbarMessage('Error en la prueba de estrés.');
        } finally {
            setStressLoading(false);
        }
    };*/

    const handleForceSync = async () => {
        setSnackbarMessage('Forzando sincronización...');
        setSnackbarVisible(true);
        await EjetrackService.processPendingLocations(true);
        await loadData();
    };

    const handleClearHistory = async () => {
        setMenuVisible(false);
        setStressLoading(true);
        try {
            await locationHistoryService.deleteAll();
            setSnackbarMessage('Historial limpiado.');
            setSnackbarVisible(true);
            await loadData();
        } finally {
            setStressLoading(false);
        }
    };

    const HeaderStats = () => (
        <View>
            <Card style={[styles.networkCard, { marginBottom: 8 }]}>
                <Card.Content style={styles.networkContent}>
                    <View style={styles.networkStatusContainer}>
                        <IconButton 
                            icon={isConnectedToInternet ? "wifi" : "wifi-off"} 
                            iconColor={isConnectedToInternet ? "#4CAF50" : "#F44336"}
                            size={20}
                            style={{ margin: 0 }}
                        />
                        <Text variant="labelMedium" style={{ color: isConnectedToInternet ? "#4CAF50" : "#F44336" }}>
                            {isConnectedToInternet ? "Internet Conectado" : "Sin Internet"}
                        </Text>
                    </View>
                    <Divider orientation="vertical" style={{ height: 20, marginHorizontal: 10 }} />
                    <View style={styles.networkStatusContainer}>
                        {isNetworkChecking ? (
                            <ActivityIndicator size={16} style={{ marginRight: 8 }} />
                        ) : (
                            <IconButton 
                                icon={isServerReachable ? "server" : "server-off"} 
                                iconColor={isServerReachable ? "#2196F3" : "#FFA000"}
                                size={20}
                                style={{ margin: 0 }}
                            />
                        )}
                        <Text variant="labelMedium" style={{ color: isServerReachable ? "#2196F3" : "#FFA000" }}>
                            {isServerReachable ? "Servidor Online" : "Servidor Offline"}
                        </Text>
                    </View>
                </Card.Content>
            </Card>

            <Card style={styles.headerCard}>
                <Card.Content>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text variant="labelSmall" style={styles.statLabel}>PENDIENTES</Text>
                            <Text variant="headlineSmall" style={styles.statValue}>{pendingCount}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text variant="labelSmall" style={styles.statLabel}>ESTADO LOCK</Text>
                            <Chip 
                                compact
                                selected={isSyncing}
                                selectedColor={isSyncing ? '#2196F3' : '#757575'}
                                style={{ backgroundColor: isSyncing ? '#E3F2FD' : '#F5F5F5' }}
                            >
                                {isSyncing ? 'SYNCING' : 'IDLE'}
                            </Chip>
                        </View>
                        <View style={styles.statItem}>
                            <Text variant="labelSmall" style={styles.statLabel}>ÚLTIMA SYNC</Text>
                            <Text variant="bodySmall">
                                {lastSync ? format(new Date(lastSync * 1000), "HH:mm:ss") : 'N/A'}
                            </Text>
                        </View>
                    </View>
                    
                    <View style={styles.headerActions}>
                        <IconButton 
                            icon="sync" 
                            mode="contained" 
                            size={20} 
                            onPress={handleForceSync}
                            loading={isSyncing}
                            disabled={isSyncing}
                        />
                        <Text variant="bodySmall" style={{flex: 1, marginLeft: 8}}>Forzar Sincronización Manual</Text>
                    </View>
                </Card.Content>
            </Card>
        </View>
    );

    const renderItem = ({ item }: { item: LocationHistoryEntry }) => {
        const date = new Date(item.timestamp * 1000);
        const formattedDate = format(date, "dd MMM HH:mm:ss", { locale: es });
        const isActive = EjetrackService.isPointInActiveBatch(item.id);

        return (
            <Card style={[styles.card, isActive && styles.activeCard]}>
                <Card.Content>
                    <View style={styles.cardHeader}>
                        <View>
                            <Text variant="titleMedium" style={styles.dateText}>{formattedDate}</Text>
                            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                <Text variant="bodySmall" style={styles.deviceId}>ID: {item.device_id}</Text>
                                <Text variant="bodySmall" style={[styles.deviceId, {marginLeft: 8, color: theme.colors.primary, fontWeight: 'bold'}]}>
                                    # {item.id}
                                </Text>
                            </View>
                        </View>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            {isActive && <ActivityIndicator size={16} style={{marginRight: 8}} />}
                            <Chip 
                                icon={item.synced ? "check-circle" : (isActive ? "cloud-upload" : "clock-outline")} 
                                selected={item.synced}
                                selectedColor={item.synced ? "#4CAF50" : (isActive ? "#2196F3" : "#FFA000")}
                                style={[
                                    styles.chip, 
                                    { backgroundColor: item.synced ? '#E8F5E9' : (isActive ? '#E3F2FD' : '#FFF3E0') }
                                ]}
                            >
                                {item.synced ? "Enviado" : (isActive ? "En Lote" : "Pendiente")}
                            </Chip>
                        </View>
                    </View>
                    
                    <Divider style={styles.divider} />
                    
                    <View style={styles.detailsGrid}>
                        <View style={styles.detailItem}>
                            <IconButton icon="crosshairs-gps" size={20} style={styles.icon} />
                            <View>
                                <Text variant="bodySmall">Coordenadas</Text>
                                <Text variant="bodyMedium">{item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}</Text>
                            </View>
                        </View>
                        <View style={styles.detailItem}>
                            <IconButton icon="speedometer" size={20} style={styles.icon} />
                            <View>
                                <Text variant="bodySmall">Velocidad</Text>
                                <Text variant="bodyMedium">{item.speed.toFixed(1)} km/h</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.detailsGrid}>
                        <View style={styles.detailItem}>
                            <IconButton icon="key-variant" size={20} style={styles.icon} />
                            <View>
                                <Text variant="bodySmall">Ignición</Text>
                                <Text variant="bodyMedium">{item.ignition ? "ENCENDIDO" : "APAGADO"}</Text>
                            </View>
                        </View>
                    </View>
                </Card.Content>
            </Card>
        );
    };

    if (loading && !refreshing && !stressLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
                <Text style={styles.loadingText}>Cargando historial...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <HeaderStats />
            
            <FlashList
                data={locations}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                estimatedItemSize={150}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <IconButton icon="map-marker-off" size={60} disabled />
                        <Text variant="headlineSmall">Sin posiciones</Text>
                        <Text variant="bodyMedium" style={styles.emptySubtext}>
                            Aún no se han registrado posiciones en este dispositivo.
                        </Text>
                    </View>
                }
            />

            <Portal>
                <FAB.Group
                    open={menuVisible}
                    visible
                    icon={menuVisible ? 'close' : 'wrench'}
                    actions={[
                        /*{
                            icon: 'flash',
                            label: 'Prueba de Estrés (100 pts)',
                            onPress: handleStressTest,
                        },*/
                        {
                            icon: 'delete-sweep',
                            label: 'Limpiar Historial',
                            onPress: handleClearHistory,
                        },
                        {
                            icon: 'sync',
                            label: 'Forzar Sincronización',
                            onPress: handleForceSync,
                        },
                    ]}
                    onStateChange={({ open }) => setMenuVisible(open)}
                />
            </Portal>

            <Snackbar
                visible={snackbarVisible}
                onDismiss={() => setSnackbarVisible(false)}
                duration={3000}
                action={{
                    label: 'OK',
                    onPress: () => setSnackbarVisible(false),
                }}
            >
                {snackbarMessage}
            </Snackbar>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: '#666',
    },
    listContent: {
        padding: 12,
        paddingBottom: 80,
    },
    headerCard: {
        marginHorizontal: 12,
        marginTop: 8,
        marginBottom: 4,
        borderRadius: 12,
        backgroundColor: '#fff',
        elevation: 4,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statLabel: {
        color: '#757575',
        fontWeight: 'bold',
        marginBottom: 4,
    },
    statValue: {
        fontWeight: 'bold',
        color: '#333',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingTop: 8,
    },
    card: {
        marginBottom: 12,
        elevation: 2,
        borderRadius: 12,
        backgroundColor: '#fff',
    },
    activeCard: {
        borderWidth: 1,
        borderColor: '#2196F3',
        backgroundColor: '#F0F7FF',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    dateText: {
        fontWeight: 'bold',
        color: '#333',
    },
    deviceId: {
        color: '#888',
    },
    chip: {
        height: 32,
    },
    divider: {
        marginVertical: 10,
    },
    detailsGrid: {
        flexDirection: 'row',
        marginTop: 4,
    },
    detailItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    icon: {
        margin: 0,
        marginRight: -4,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 100,
        paddingHorizontal: 40,
    },
    emptySubtext: {
        textAlign: 'center',
        color: '#888',
        marginTop: 8,
    },
    networkCard: {
        marginHorizontal: 12,
        marginTop: 12,
        borderRadius: 12,
        backgroundColor: '#fff',
        elevation: 2,
    },
    networkContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 0,
        paddingHorizontal: 8,
    },
    networkStatusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    }
});
