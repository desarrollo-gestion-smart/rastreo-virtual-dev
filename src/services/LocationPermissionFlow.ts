/**
 * Flujo de permisos de ubicación estilo Uber/Cabify.
 * Solicitud en dos pasos: foreground → background.
 * Cumple buenas prácticas de Google Play.
 */
import * as Location from 'expo-location';
import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';

const STORAGE_EDUCATIONAL_SEEN = 'location_edu_screen_seen';
const PACKAGE_NAME = Application.applicationId || 'com.ejesatelital.rndc';

export type LocationPermissionStatus =
  | 'undetermined'
  | 'denied'
  | 'granted_foreground'
  | 'granted_background';

export type PrepareResult = 'ready' | 'needs_settings' | 'denied';

/**
 * Verifica el estado actual de permisos sin solicitar.
 */
export async function getLocationPermissionStatus(): Promise<LocationPermissionStatus> {
  const { status: fg } = await Location.getForegroundPermissionsAsync();
  if (fg !== 'granted') {
    return fg === 'denied' ? 'denied' : 'undetermined';
  }
  if (Platform.OS === 'android' && (Platform.Version as number) >= 29) {
    const { status: bg } = await Location.getBackgroundPermissionsAsync();
    return bg === 'granted' ? 'granted_background' : 'granted_foreground';
  }
  return 'granted_background';
}

/**
 * Indica si el usuario ya vio la pantalla educativa.
 */
export async function hasSeenEducationalScreen(): Promise<boolean> {
  return (await AsyncStorage.getItem(STORAGE_EDUCATIONAL_SEEN)) === 'true';
}

export async function markEducationalScreenSeen(): Promise<void> {
  await AsyncStorage.setItem(STORAGE_EDUCATIONAL_SEEN, 'true');
}

/**
 * Paso 1: Solicita permiso de ubicación en primer plano.
 */
export async function requestForegroundPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Paso 2: Solicita permiso de ubicación en segundo plano (Android 10+).
 */
export async function requestBackgroundPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if ((Platform.Version as number) < 29) return true;
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Abre el diálogo del sistema para solicitar permiso de ubicación en segundo plano.
 * Cuando el usuario tiene "mientras en uso", muestra la pantalla para cambiar a "Permitir todo el tiempo".
 */
export async function openLocationPermissionDialog(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if ((Platform.Version as number) >= 29) {
    await Location.requestBackgroundPermissionsAsync();
  } else {
    await openAppSettingsForLocation();
  }
}

/**
 * Abre los ajustes de la app para que el usuario cambie permisos manualmente.
 */
export async function openAppSettingsForLocation(): Promise<void> {
  if (Platform.OS !== 'android') {
    Linking.openSettings();
    return;
  }
  try {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
      { data: `package:${PACKAGE_NAME}` }
    );
  } catch {
    await Linking.openSettings();
  }
}

/**
 * Muestra alerta para ir a Ajustes cuando el permiso está denegado o es "solo en uso".
 */
export function showGoToSettingsAlert(
  reason: 'denied' | 'foreground_only',
  onPressGoToSettings: () => void
): void {
  const title =
    reason === 'denied'
      ? 'Permiso de ubicación requerido'
      : 'Permiso para rastreo con pantalla apagada';
  const message =
    reason === 'denied'
      ? 'Para registrar tu ruta necesitamos acceso a tu ubicación. Actívalo en Ajustes.'
      : 'Para rastrear con la pantalla apagada, cambia el permiso a "Permitir todo el tiempo" en Ajustes.';
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Ir a Ajustes', onPress: onPressGoToSettings },
  ]);
}

/**
 * Flujo completo: verifica y solicita permisos en dos pasos.
 * Retorna 'ready' si puede iniciar tracking, 'needs_settings' si debe ir a Ajustes, 'denied' si rechazó.
 */
export async function prepareForTracking(): Promise<PrepareResult> {
  // 1. Foreground
  const fgCurrent = await Location.getForegroundPermissionsAsync();
  if (fgCurrent.status !== 'granted') {
    const granted = await requestForegroundPermission();
    if (!granted) {
      showGoToSettingsAlert('denied', openAppSettingsForLocation);
      return 'needs_settings';
    }
  }

  // 2. Background (Android 10+)
  if (Platform.OS === 'android' && (Platform.Version as number) >= 29) {
    const bgCurrent = await Location.getBackgroundPermissionsAsync();
    if (bgCurrent.status !== 'granted') {
      const granted = await requestBackgroundPermission();
      if (!granted) {
<<<<<<< HEAD
        showGoToSettingsAlert('foreground_only', openAppSettingsForLocation);
=======
>>>>>>> bdb814cf1b21d80d6a9bc8e4c1cd252ab2b886c5
        return 'needs_settings';
      }
    }
  }

  return 'ready';
}
