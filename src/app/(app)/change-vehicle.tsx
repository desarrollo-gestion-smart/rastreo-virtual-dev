import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, FlatList, Platform } from 'react-native';
import { Text, useTheme, Icon, ActivityIndicator, Searchbar, Appbar } from 'react-native-paper';
import { useDeviceStore } from '@/store/deviceStore';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { type Device } from '@/models/device-model';

// Interfaz para el item de la lista
interface SelectableVehicle {
    id: number;
    label: string;
    imageUrl: string | null;
    data: Device;
}

const ChangeVehicleScreen = () => {
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    
    // Conectamos al store de dispositivos
    const { devices, currentDevice, setCurrentDevice, hydrate: hydrateDevices, loading } = useDeviceStore();

    const [searchQuery, setSearchQuery] = useState('');

    // Hidratamos los dispositivos al cargar la pantalla
    useEffect(() => {
        hydrateDevices();
    }, []);
    
    // Mapeamos los dispositivos a la lista
    const allItems: SelectableVehicle[] = useMemo(() => 
        devices.map(d => ({
            id: d.id,
            label: d.plate || d.name,
            imageUrl: d.image_link || null,
            data: d
        }))
    , [devices]);

    // Filtramos basados en la búsqueda
    const filteredItems = useMemo(() => {
        if (!searchQuery) return allItems;
        return allItems.filter(item => 
            item.label.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [allItems, searchQuery]);

    // Acción al seleccionar
    const handleSelectDevice = async (deviceId: number) => {
        await setCurrentDevice(deviceId);
        router.back(); // Volvemos a la pantalla Home
    };

    const isDark = theme.dark;
    const listBottomPadding = insets.bottom + 24;

    // Header: blanco y azul en modo claro
    const renderHeader = () => (
        <LinearGradient
            colors={isDark ? ['#1a1a1a', '#2c2c2c'] : ['#0085FF', '#0058D6']}
            style={[styles.header, { paddingTop: insets.top }]}
        >
            <Appbar.Header style={styles.appbar}>
                <Appbar.BackAction onPress={() => router.back()} color="white" />
                <Appbar.Content title="Seleccionar Vehículo" titleStyle={styles.headerTitle} color="white" />
            </Appbar.Header>
            <Searchbar
                placeholder="Buscar vehículo..."
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={[styles.searchbar, { backgroundColor: isDark ? theme.colors.surface : '#fff' }]}
                inputStyle={styles.searchbarInput}
                iconColor={isDark ? theme.colors.primary : '#0085FF'}
                textColor={theme.colors.onSurface}
                placeholderTextColor={theme.colors.onSurfaceVariant}
            />
        </LinearGradient>
    );

    // Render de cada item — modo claro: blanco/azul; último ítem con margen
    const renderItem = ({ item, index }: { item: SelectableVehicle; index: number }) => {
        const isSelected = item.id === currentDevice?.id;
        const isLast = index === filteredItems.length - 1;
        const color = isSelected ? '#fff' : theme.colors.onSurface;
        const borderColor = isSelected ? 'transparent' : (isDark ? '#444' : '#0085FF');
        const imagePlaceholder = `https://via.placeholder.com/60/${isDark ? '444' : 'E3F2FD'}/${isDark ? '666' : '0085FF'}?text=${item.label.charAt(0)}`;

        const itemContent = (
            <View style={styles.itemContent}>
                <Image
                    source={{ uri: item.imageUrl || imagePlaceholder }}
                    style={styles.itemImage}
                    placeholder={imagePlaceholder}
                    contentFit="cover"
                    transition={300}
                />
                <Text style={[styles.itemText, { color }]} numberOfLines={1}>{item.label}</Text>
                {isSelected && <Icon source="check-circle" size={20} color="#fff" />}
            </View>
        );

        return (
            <View style={[styles.itemWrapper, isLast && { marginBottom: 12 }]}>
                <TouchableOpacity onPress={() => handleSelectDevice(item.id)} activeOpacity={0.8}>
                    {isSelected ? (
                        <LinearGradient
                            colors={isDark ? ['#333', '#444'] : ['#0085FF', '#0058D6']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.itemCard, styles.itemCardSelected]}
                        >
                            {itemContent}
                        </LinearGradient>
                    ) : (
                        <View style={[styles.itemCard, styles.itemCardUnselected, {
                            borderColor,
                            backgroundColor: isDark ? theme.colors.surface : '#fff',
                        }]}>
                            {itemContent}
                        </View>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: isDark ? theme.colors.background : '#F5F9FF' }]}>
            {renderHeader()}
            {loading ? (
                <ActivityIndicator style={{ marginTop: 20 }} size="large" />
            ) : (
                <FlatList
                    data={filteredItems}
                    keyExtractor={(item) => String(item.id)}
                    style={styles.list}
                    contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPadding }]}
                    renderItem={renderItem}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyContainer}>
                            <Icon source="magnify-close" size={40} color={theme.colors.outline} />
                            <Text style={[styles.emptyText, { color: theme.colors.outline }]}>No se encontraron vehículos</Text>
                        </View>
                    )}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingBottom: 15,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
    },
    appbar: {
        backgroundColor: 'transparent',
        elevation: 0,
    },
    headerTitle: {
        fontWeight: 'bold',
    },
    searchbar: {
        marginHorizontal: 15,
        borderRadius: 10,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        minHeight: 44,
        height: 44,
    },
    searchbarInput: {
        paddingTop: 0,
        paddingBottom: 8,
        marginTop: 0,
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: 15,
        paddingTop: 16,
    },
    itemWrapper: {
        marginBottom: 6,
    },
    itemCard: {
        borderRadius: 14,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    itemCardUnselected: {
        borderWidth: 2,
    },
    itemCardSelected: {
        borderWidth: 0,
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    itemImage: {
        width: 44,
        height: 44,
        borderRadius: 22,
        marginRight: 12,
        backgroundColor: '#E3F2FD',
    },
    itemText: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 50,
        opacity: 0.6,
    },
    emptyText: {
        marginTop: 10,
        fontSize: 16,
    },
});

export default ChangeVehicleScreen;