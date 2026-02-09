import { Platform, Linking } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';

const PACKAGE_NAME = Application.applicationId || 'com.ejesatelital.rndc';

// Intent para abrir directamente la pantalla de permisos de la app (Android 8+)
const MANAGE_APP_PERMISSIONS = 'android.settings.action.MANAGE_APP_PERMISSIONS';
const EXTRA_PACKAGE_NAME = 'android.intent.extra.PACKAGE_NAME';

/**
 * Abre los ajustes de la app (pantalla de información de la aplicación).
 * Desde ahí el usuario puede ir a Batería, Permisos, etc.
 */
export async function openAppSettings(): Promise<void> {
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
 * Abre directamente la pantalla de permisos de la app.
 * Si no está disponible, abre los ajustes generales de la app.
 */
export async function openAppPermissionsSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    Linking.openSettings();
    return;
  }
  try {
    await IntentLauncher.startActivityAsync(MANAGE_APP_PERMISSIONS, {
      extra: { [EXTRA_PACKAGE_NAME]: PACKAGE_NAME },
    });
  } catch {
    // Fallback: pantalla de permisos no disponible, abrir ajustes de la app
    await openAppSettings();
  }
}
