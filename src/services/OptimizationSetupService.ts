import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';

const STORAGE_KEY_OPTIMIZATION_SHOWN = 'optimization_setup_shown';
const STORAGE_KEY_BATTERY_SETTINGS_OPENED_AT = 'battery_settings_opened_at';
const BATTERY_TRUST_WINDOW_MS = 5 * 60 * 1000; // 5 minutos
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

    // Abrir ajustes de la app para configurar batería
    const openBatterySettings = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Optimización de batería',
        'Se abrirán los ajustes. Sigue estos pasos:\n\n1. Toca "Batería" o "Uso de batería"\n2. Selecciona "Sin restricciones" o "No restringir"',
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

  const openBattery = await new Promise<boolean>((resolve) => {
    Alert.alert(
      'Optimización de batería',
      'Se abrirán los ajustes. Sigue estos pasos:\n\n1. Toca "Batería" o "Uso de batería"\n2. Selecciona "Sin restricciones" o "No restringir"',
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
 * Marca que el usuario fue enviado a ajustes de batería (para confiar en que configuró).
 */
async function markBatterySettingsOpened(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_BATTERY_SETTINGS_OPENED_AT, String(Date.now()));
}

/**
 * Limpia la confianza de batería. Llamar cuando se inicia una ruta con éxito,
 * para que la próxima vez se vuelva a verificar si corresponde.
 */
export async function clearBatterySettingsTrust(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY_BATTERY_SETTINGS_OPENED_AT);
}

/**
 * Abre la pantalla de información de la app.
 * Usamos APPLICATION_DETAILS_SETTINGS (IntentLauncher) para evitar
 * diálogos del sistema que muestran "permitir ejecute en segundo plano".
 */
export async function openAppSettingsForBattery(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
      { data: `package:${PACKAGE_NAME}` }
    );
    await markBatterySettingsOpened();
  } catch (err) {
    console.warn('[OptimizationSetup] APPLICATION_DETAILS_SETTINGS falló:', err);
    try {
      await Linking.openSettings();
      await markBatterySettingsOpened();
    } catch {
      // Nada más que intentar
    }
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
 * Indica si la app tiene restricción de batería (NO está en "sin restricciones").
 * Retorna true cuando la optimización está activa (hay que mostrar el modal).
 * Retorna false cuando está en "sin restricciones" o no aplica (iOS, Android < 6).
 */
export async function isBatteryRestricted(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const { BatteryOptEnabled } = require('react-native-battery-optimization-check');
    const enabled = await BatteryOptEnabled();
    // true = optimización activa ("optimizado") -> hay restricción -> mostrar modal
    return enabled === true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('null') && !msg.includes('isBatteryOptEnabled')) {
      console.warn('[OptimizationSetup] Error verificando batería:', err);
    }
    const openedAt = await AsyncStorage.getItem(STORAGE_KEY_BATTERY_SETTINGS_OPENED_AT);
    if (openedAt) {
      const elapsed = Date.now() - parseInt(openedAt, 10);
      if (elapsed < BATTERY_TRUST_WINDOW_MS) {
        return false;
      }
    }
    return true;
  }
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
