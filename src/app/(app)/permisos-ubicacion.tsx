import React from 'react';
import { StyleSheet, View } from 'react-native';
import { List, useTheme, Appbar, Card, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { openAppSettings } from '@/services/AppSettingsService';

const OPCIONES = [
  {
    id: 'always' as const,
    title: 'Permitir siempre',
    description: 'Ideal para rastreo. Permite ubicación con la pantalla apagada.',
    pasos: 'Permisos → Ubicación → "Permitir todo el tiempo"',
    icon: 'map-marker-radius',
  },
  {
    id: 'while_in_use' as const,
    title: 'Permitir solo en uso',
    description: 'Ubicación solo cuando la app está abierta.',
    pasos: 'Permisos → Ubicación → "Permitir solo mientras uses la app"',
    icon: 'cellphone',
  },
  {
    id: 'ask' as const,
    title: 'Preguntarme cada vez',
    description: 'El sistema preguntará cuando lo necesite.',
    pasos: 'Permisos → Ubicación → "Preguntar cada vez"',
    icon: 'help-circle-outline',
  },
];

export default function PermisosUbicacionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = theme.dark;

  const handleSelectOption = async () => {
    await openAppSettings();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={isDark ? ['#1a1a1a', '#2c2c2c'] : ['#3a47d5', '#0072ff']}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <Appbar.Header style={styles.appbar}>
          <Appbar.BackAction onPress={() => router.back()} color="white" />
          <Appbar.Content
            title="Permisos de ubicación"
            titleStyle={styles.headerTitle}
            color="white"
          />
        </Appbar.Header>
      </LinearGradient>

      <Card style={[styles.guiaCard, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Card.Content>
          <Text variant="titleSmall" style={{ color: theme.colors.primary, fontWeight: '600', marginBottom: 8 }}>
            Cómo cambiarlo
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, lineHeight: 22 }}>
            1. Toca la opción que quieras{'\n'}
            2. Se abrirán los ajustes de la app{'\n'}
            3. Toca <Text style={{ fontWeight: '700' }}>Permisos</Text>{'\n'}
            4. Toca <Text style={{ fontWeight: '700' }}>Ubicación</Text>{'\n'}
            5. Elige la opción deseada
          </Text>
        </Card.Content>
      </Card>

      <List.Section style={styles.section}>
        <List.Subheader style={{ color: theme.colors.onSurface }}>
          Elige la opción que quieras configurar
        </List.Subheader>
        {OPCIONES.map((opcion) => (
          <List.Item
            key={opcion.id}
            title={opcion.title}
            description={`${opcion.description}\n→ ${opcion.pasos}`}
            descriptionNumberOfLines={4}
            left={(props) => <List.Icon {...props} icon={opcion.icon} />}
            right={(props) => <List.Icon {...props} icon="chevron-right" />}
            onPress={handleSelectOption}
            style={styles.listItem}
          />
        ))}
      </List.Section>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 8 },
  appbar: { backgroundColor: 'transparent', elevation: 0 },
  headerTitle: { fontWeight: '600', fontSize: 18 },
  guiaCard: { margin: 16, marginBottom: 8 },
  section: { marginTop: 8 },
  listItem: { backgroundColor: 'transparent' },
});
