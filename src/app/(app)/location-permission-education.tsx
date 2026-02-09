import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, Button, useTheme, Appbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { markEducationalScreenSeen } from '@/services/LocationPermissionFlow';

export default function LocationPermissionEducationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = theme.dark;

  const handleContinue = async () => {
    await markEducationalScreenSeen();
    router.replace('/');
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
            title="Ubicación"
            titleStyle={styles.headerTitle}
            color="white"
          />
        </Appbar.Header>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onSurface }]}>
          Tu ubicación hace posible el rastreo en tiempo real
        </Text>

        <Text variant="bodyLarge" style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>
          Necesitamos tu ubicación para:
        </Text>
        <View style={styles.bulletList}>
          {[
            'Registrar tu ruta mientras conduces',
            'Enviar tu posición al centro de operaciones en tiempo real',
            'Cumplir con los tiempos y la trazabilidad del servicio',
          ].map((item, i) => (
            <Text
              key={i}
              variant="bodyMedium"
              style={[styles.bullet, { color: theme.colors.onSurfaceVariant }]}
            >
              • {item}
            </Text>
          ))}
        </View>

        <Text variant="bodyMedium" style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>
          Tu ubicación solo se usa durante el servicio activo y se comparte únicamente con tu empresa.
        </Text>

        <View style={[styles.card, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text variant="titleSmall" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '600', marginBottom: 4 }}>
            Si no otorgas el permiso
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Sin ubicación no podrás iniciar rutas ni enviar tu posición. Tendrás que usar otro método para reportar tu recorrido.
          </Text>
        </View>

        <Button
          mode="contained"
          onPress={handleContinue}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          Entendido, continuar
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 8 },
  appbar: { backgroundColor: 'transparent', elevation: 0 },
  headerTitle: { fontWeight: '600', fontSize: 18 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  title: {
    fontWeight: '700',
    marginBottom: 20,
    lineHeight: 32,
  },
  body: {
    marginBottom: 12,
    lineHeight: 22,
  },
  bulletList: { marginBottom: 16, marginLeft: 4 },
  bullet: { marginBottom: 6, lineHeight: 22 },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 28,
  },
  button: { borderRadius: 12 },
  buttonContent: { paddingVertical: 6 },
});
