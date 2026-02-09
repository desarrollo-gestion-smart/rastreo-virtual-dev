import React, { useEffect } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { Text, List, useTheme, Appbar, Switch, HelperText } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTransmissionConfigStore } from '@/store/transmissionConfigStore';
import { activateTransmissionSinRestriccion, deactivateTransmissionSinRestriccion } from '@/services/OptimizationSetupService';

const TOOLTIP_ACTIVADO =
  'La app no será restringida por el ahorro de batería. El rastreo continuará con la pantalla apagada.';
const TOOLTIP_DESACTIVADO =
  'La batería estará optimizada. El rastreo puede detenerse tras unos minutos con la pantalla apagada.';

export default function TransmisionDatosScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDark = theme.dark;
  const { transmissionSinRestriccion, isLoading, load, setTransmissionSinRestriccion } =
    useTransmissionConfigStore();

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (value: boolean) => {
    await setTransmissionSinRestriccion(value);
    if (value) {
      if (Platform.OS === 'android') {
        await activateTransmissionSinRestriccion();
      }
    } else {
      if (Platform.OS === 'android') {
        await deactivateTransmissionSinRestriccion();
      }
    }
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
            title="Transmisión de datos"
            titleStyle={styles.headerTitle}
            color="white"
          />
        </Appbar.Header>
      </LinearGradient>

      <List.Section style={styles.section}>
        <List.Item
          title="Transmisión sin restricción"
          description={
            transmissionSinRestriccion ? TOOLTIP_ACTIVADO : TOOLTIP_DESACTIVADO
          }
          descriptionNumberOfLines={3}
          left={(props) => <List.Icon {...props} icon="battery-sync" />}
          right={() => (
            <Switch
              value={transmissionSinRestriccion}
              onValueChange={handleToggle}
              disabled={isLoading}
              color={theme.colors.primary}
            />
          )}
          style={styles.listItem}
        />
        <HelperText type="info" visible>
          Activado: se abre un diálogo o los ajustes. Sigue los pasos para seleccionar "Sin restricciones" en Batería. Desactivado: se abren los ajustes para que puedas revertir la optimización.
        </HelperText>
      </List.Section>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 8 },
  appbar: { backgroundColor: 'transparent', elevation: 0 },
  headerTitle: { fontWeight: '600', fontSize: 18 },
  section: { marginTop: 16 },
  listItem: { backgroundColor: 'transparent' },
});
