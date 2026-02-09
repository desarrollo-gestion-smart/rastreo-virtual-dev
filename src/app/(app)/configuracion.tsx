import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, List, useTheme, Appbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function ConfiguracionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = theme.dark;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={isDark ? ['#1a1a1a', '#2c2c2c'] : ['#3a47d5', '#0072ff']}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <Appbar.Header style={styles.appbar}>
          <Appbar.BackAction onPress={() => router.back()} color="white" />
          <Appbar.Content title="Configuración" titleStyle={styles.headerTitle} color="white" />
        </Appbar.Header>
      </LinearGradient>
      <List.Section>
        <List.Subheader style={{ color: theme.colors.onSurface }}>TRANSMISIÓN</List.Subheader>
        <List.Item
          title="Transmisión de datos"
          description="Configurar uso de batería y datos"
          left={(props) => <List.Icon {...props} icon="transit-connection-variant" />}
          onPress={() => router.push('/transmision-datos')}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          style={styles.listItem}
        />
        <List.Item
          title="Permisos de ubicación"
          description="Permitir siempre, solo en uso o preguntar"
          left={(props) => <List.Icon {...props} icon="map-marker-radius" />}
          onPress={() => router.push('/permisos-ubicacion')}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
          style={styles.listItem}
        />
      </List.Section>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 8 },
  appbar: { backgroundColor: 'transparent', elevation: 0 },
  headerTitle: { fontWeight: '600', fontSize: 18 },
  listItem: { backgroundColor: 'transparent' },
});
