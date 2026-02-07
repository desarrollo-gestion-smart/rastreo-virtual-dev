import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, View, TouchableOpacity, FlatList, Platform } from 'react-native';
import { Text, Button, useTheme, Icon, ActivityIndicator, Searchbar, Appbar } from 'react-native-paper';
import { useDeviceStore } from '@/store/deviceStore';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image'; // Usamos expo-image para cacheo
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

    // Header personalizado
    const renderHeader = () => (
        <LinearGradient
            colors={isDark ? ['#1a1a1a', '#2c2c2c'] : ['#E91E63', '#9C27B0']} // Gradiente del header
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
                style={[styles.searchbar, { backgroundColor: isDark ? theme.colors.surface : 'white' }]}
                iconColor={theme.colors.primary}
                textColor={theme.colors.onSurface}
                placeholderTextColor={theme.colors.onSurfaceVariant}
            />
        </LinearGradient>
    );

    // Render de cada item
    const renderItem = ({ item }: { item: SelectableVehicle }) => {
        const isSelected = item.id === currentDevice?.id;
        const color = isSelected ? 'white' : theme.colors.onSurface; // Color de texto
        const borderColor = isSelected ? 'transparent' : (isDark ? '#444' : '#E91E63'); // Borde rosa/rojo
        const imagePlaceholder = `https://via.placeholder.com/60/CCCCCC/FFFFFF?text=${item.label.charAt(0)}`;

        const itemContent = (
            <View style={styles.itemContent}>
                <Image
                    source={{ uri: item.imageUrl || imagePlaceholder }}
                    style={styles.itemImage}
                    placeholder={imagePlaceholder}
                    contentFit="cover"
                    transition={300}
                />
                <Text style={[styles.itemText, { color }]}>{item.label}</Text>
            </View>
        );

        return (
            <TouchableOpacity onPress={() => handleSelectDevice(item.id)}>
                {isSelected ? (
                    <LinearGradient
                        colors={isDark ? ['#333', '#444'] : ['#FF8C00', '#E91E63']} // Gradiente Naranja a Rosa
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.itemCard, styles.itemCardSelected]}
                    >
                        {itemContent}
                    </LinearGradient>
                ) : (
                    <View style={[styles.itemCard, styles.itemCardUnselected, { 
                        borderColor, 
                        backgroundColor: theme.colors.surface 
                    }]}>
                        {itemContent}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {renderHeader()}
            {loading ? (
                <ActivityIndicator style={{ marginTop: 20 }} size="large" />
            ) : (
                <FlatList
                    data={filteredItems}
                    keyExtractor={(item) => String(item.id)}
                    style={styles.list}
                    renderItem={renderItem}
                    ListEmptyComponent={() => (
                         <View style={styles.emptyContainer}>
                             <Icon source="magnify-close" size={40} color={theme.colors.outline}/>
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
    },
    list: {
        flex: 1,
        paddingHorizontal: 15,
        paddingTop: 10,
    },
    itemCard: {
        marginVertical: 6,
        borderRadius: 12,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    itemCardUnselected: {
        borderWidth: 2,
    },
    itemCardSelected: {
        borderWidth: 2,
        borderColor: 'transparent',
    },
    itemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
    },
    itemImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginRight: 15,
        backgroundColor: '#eee',
    },
    itemText: {
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1, // Para que el texto se ajuste
    },
    emptyContainer: {
        alignItems: 'center', 
        marginTop: 50, 
        opacity: 0.5
    },
    emptyText: {
        marginTop: 10, 
        fontSize: 16
    }
});

export default ChangeVehicleScreen;