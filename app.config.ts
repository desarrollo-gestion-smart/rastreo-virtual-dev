import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Rastreo Virtual",
  slug: "rutas",
  version: "1.0.000",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "rndc",
  userInterfaceStyle: "automatic",
  // newArchEnabled suele ir en plugins o propiedades root específicas según versión, 
  // en config dinámico lo pasamos directo.
  // @ts-ignore
  newArchEnabled: true, 
  splash: {
    image: "./assets/images/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.ejesatelital.rndc",
    userInterfaceStyle: "automatic",
    infoPlist: {
      UIBackgroundModes: [
        "remote-notification",
        "location"
      ],
      NSLocationWhenInUseUsageDescription: "Necesitamos tu ubicación para rastrear el viaje en tiempo real y calcular alertas de descanso.",
      NSLocationAlwaysAndWhenInUseUsageDescription: "Necesitamos tu ubicación incluso en segundo plano para asegurar el seguimiento continuo del viaje y la seguridad del conductor.",
      NSLocationAlwaysUsageDescription: "Necesitamos tu ubicación para el rastreo del viaje en tiempo real."
    },
    config: {
      // AQUÍ SE LEE LA VARIABLE DE ENTORNO PARA IOS
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS || process.env.GOOGLE_MAPS_API_KEY_IOS
    }
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png"
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: "com.ejesatelital.rndc",
    allowBackup: false,
    versionCode: 10000,
    version: "1.0.000",
    googleServicesFile: "./google-services.json",
    config: {
      googleMaps: {
        // AQUÍ SE LEE LA VARIABLE DE ENTORNO PARA ANDROID
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID || process.env.GOOGLE_MAPS_API_KEY_ANDROID
      }
    },
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "POST_NOTIFICATIONS",
      "WAKE_LOCK",
      "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"
    ]
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png"
  },
  plugins: [
    "expo-router",
    //"./plugins/wiathFirebaseDependencyFix",
    "./src/plugins/withNotifeeForegroundService",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000"
        }
      }
    ],
    "expo-sqlite",
    [
      "expo-build-properties",
      {
        "android": {
          "extraMavenRepos": ["../../node_modules/@notifee/react-native/android/libs"]
        }
      }
    ],
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission: "Permitir a Conductores usar tu ubicación para el rastreo de ruta.",
        isAndroidForegroundServiceEnabled: true,
        foregroundService: {
          notificationTitle: "Seguimiento de Viaje",
          notificationBody: "Rastreo Virtual está rastreando tu ubicación en segundo plano.",
          notificationColor: "#E6F4FE"
        }
      }
    ]
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true
  },
  extra: {
    router: {},
    eas: {
      projectId: "21e05e97-11e5-44ab-94c5-891bc5b3105e"
    }
  }
  // Cuenta de pruebas (@gestion.global). Para producción: projectId "26537ce3-0e81-41d3-8321-89278b9257c0" y owner "ejesatelital"
});