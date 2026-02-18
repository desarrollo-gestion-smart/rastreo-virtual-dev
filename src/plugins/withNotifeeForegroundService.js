const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Este plugin parchea el AndroidManifest.xml para agregar
 * foregroundServiceType="location" al servicio de Notifee.
 * OBLIGATORIO para Android 14+ si usas 'asForegroundService: true'.
 */
module.exports = function withNotifeeForegroundService(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;

    // Asegurar permisos en el manifiesto para Android 14+
    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }

    const permissions = [
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_LOCATION',
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.WAKE_LOCK',
    ];

    permissions.forEach(permission => {
      if (!androidManifest.manifest['uses-permission']) {
        androidManifest.manifest['uses-permission'] = [];
      }
      const exists = androidManifest.manifest['uses-permission'].some(
          (p) => p.$['android:name'] === permission
      );
      if (!exists) {
        androidManifest.manifest['uses-permission'].push({
          $: { 'android:name': permission },
        });
      }
    });

    // Aseguramos que exista el array de 'service'
    if (!androidManifest.manifest.application[0].service) {
      androidManifest.manifest.application[0].service = [];
    }

    const services = androidManifest.manifest.application[0].service;

    // Buscamos si el servicio de Notifee ya está definido
    const notifeeServiceIndex = services.findIndex(
        (s) => s.$['android:name'] === 'app.notifee.core.ForegroundService'
    );

    if (notifeeServiceIndex >= 0) {
      services[notifeeServiceIndex].$['android:foregroundServiceType'] = 'location';
    } else {
      services.push({
        $: {
          'android:name': 'app.notifee.core.ForegroundService',
          'android:foregroundServiceType': 'location',
          'android:exported': 'false',
        },
      });
    }

    // También nos aseguramos de que el servicio de expo-location tenga el tipo correcto,
    // por si acaso el plugin oficial no lo está inyectando correctamente en esta versión.
    const expoLocationServiceIndex = services.findIndex(
        (s) => s.$['android:name'] === 'expo.modules.location.services.LocationTaskService'
    );

    if (expoLocationServiceIndex >= 0) {
      services[expoLocationServiceIndex].$['android:foregroundServiceType'] = 'location';
    } else {
      services.push({
        $: {
          'android:name': 'expo.modules.location.services.LocationTaskService',
          'android:foregroundServiceType': 'location',
          'android:exported': 'false',
        },
      });
    }

    // Parche para TaskManager (expo-task-manager) si se usa para location
    const expoTaskManagerServiceIndex = services.findIndex(
        (s) => s.$['android:name'] === 'expo.modules.taskmanager.TaskJobService'
    );

    if (expoTaskManagerServiceIndex >= 0) {
      services[expoTaskManagerServiceIndex].$['android:foregroundServiceType'] = 'location';
    }

    return config;
  });
};
