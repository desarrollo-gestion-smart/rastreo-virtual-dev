import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';

const STORAGE_KEY_OPTIMIZATION_SHOWN = 'optimization_setup_shown';
const PACKAGE_NAME = Application.applicationId || 'com.ejesatelital.rndc';

/**
 * Muestra el flujo para configurar optimización de batería y datos.
 * Solo se muestra una vez por instalación (o hasta que se borre el storage).
 */
export async function runOptimizationSetupIfNeeded(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const alreadyShown = await AsyncStorage.getItem(STORAGE_KEY_OPTIMIZATION_SHOWN);
    if (alreadyShown === 'true') return;

    const runSetup = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Configuración para rastreo en segundo plano',
        'Para que la ubicación se siga enviando con la pantalla apagada, necesitamos configurar dos opciones. Solo tomará un momento.',
        [
          { text: 'Ahora no', onPress: () => resolve(false), style: 'cancel' },
          { text: 'Configurar', onPress: () => resolve(true) },
        ]
      );
    });

    if (!runSetup) return;

    // 1. Optimización de batería: diálogo del sistema (un toque)
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
        { data: `package:${PACKAGE_NAME}` }
      );
    } catch (batteryErr: unknown) {
      const msg = batteryErr instanceof Error ? batteryErr.message : String(batteryErr);
      console.warn('[OptimizationSetup] Error al solicitar exclusión de batería:', msg);
    }

    // 2. Batería: abrir ajustes de la app
    const openBatterySettings = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Optimización de batería',
        'Se abrirán los ajustes. Sigue estos pasos:\n\n1. Toca "Batería"\n2. Toca "Optimización de batería" o "Uso de batería"\n3. Busca Rastreo Virtual\n4. Selecciona "Sin restricciones"',
        [
          { text: 'Omitir', onPress: () => resolve(false), style: 'cancel' },
          { text: 'Ir a Ajustes', onPress: () => resolve(true) },
        ]
      );
    });

    if (openBatterySettings) {
      try {
        await IntentLauncher.startActivityAsync(
          IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
          { data: `package:${PACKAGE_NAME}` }
        );
      } catch (err) {
        await Linking.openSettings();
      }
    }

    await AsyncStorage.setItem(STORAGE_KEY_OPTIMIZATION_SHOWN, 'true');
    console.log('[OptimizationSetup] Flujo de configuración completado');
  } catch (error) {
    console.error('[OptimizationSetup] Error:', error);
  }
}

/**
 * Permite volver a mostrar el flujo (ej. desde ajustes de la app).
 */
export async function resetOptimizationSetupFlag(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY_OPTIMIZATION_SHOWN);
}

/**
 * Activa "transmisión sin restricción": solicita exclusión de batería y guía para datos.
 * Llamar cuando el usuario activa el toggle en Configuración.
 */
export async function activateTransmissionSinRestriccion(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
      { data: `package:${PACKAGE_NAME}` }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[OptimizationSetup] Error al solicitar exclusión de batería:', msg);
  }

  const openBattery = await new Promise<boolean>((resolve) => {
    Alert.alert(
      'Optimización de batería',
      'Se abrirán los ajustes. Sigue estos pasos:\n\n1. Toca "Batería"\n2. Toca "Optimización de batería" o "Uso de batería"\n3. Busca Rastreo Virtual\n4. Selecciona "Sin restricciones"',
      [
        { text: 'Omitir', onPress: () => resolve(false), style: 'cancel' },
        { text: 'Ir a Ajustes', onPress: () => resolve(true) },
      ]
    );
  });

  if (openBattery) {
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
        { data: `package:${PACKAGE_NAME}` }
      );
    } catch (err) {
      await Linking.openSettings();
    }
  }
}

/**
 * Abre los ajustes de la app para configurar la batería manualmente.
 * El diálogo REQUEST_IGNORE_BATTERY_OPTIMIZATIONS no aparece en muchos dispositivos,
 * así que abrimos la pantalla de información de la app donde el usuario puede ir a
 * Batería → Optimización de batería → Sin restricciones.
 */
export async function openAppSettingsForBattery(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
      { data: `package:${PACKAGE_NAME}` }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[OptimizationSetup] Error al abrir ajustes:', msg);
    await Linking.openSettings();
  }
}

/**
 * Marca que el instructivo de batería ya fue mostrado.
 */
export async function markBatteryModalShown(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_OPTIMIZATION_SHOWN, 'true');
}

/**
 * Indica si ya se mostró el instructivo de batería.
 */
export async function hasShownBatteryModal(): Promise<boolean> {
  return (await AsyncStorage.getItem(STORAGE_KEY_OPTIMIZATION_SHOWN)) === 'true';
}

/**
 * Revierte a transmisión restringida: abre la pantalla para que el usuario
 * configure la app como optimizada manualmente.
 */
export async function deactivateTransmissionSinRestriccion(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
      { data: `package:${PACKAGE_NAME}` }
    );
  } catch (err: unknown) {
    await Linking.openSettings();
  }
}
