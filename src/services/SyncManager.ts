import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { AppsApi } from '../api'; // 👈 Asegúrate de importar tu cliente Axios configurado (el que tiene el Bearer Token)
import * as Application from 'expo-application';
import { useAuthStore } from '@/store/authStore';

export class SyncManager {
    
    /**
     * Envía el token Push al backend para asociarlo al usuario actual.
     * @param token El token de Expo (ExponentPushToken[...])
     */
    public async registerDeviceToken(token: string | undefined | null): Promise<void> {
        if (!token) {
            console.warn('⚠️ SyncManager: Se intentó registrar un token vacío.');
            return;
        }

        try {
            console.log("🔄 SyncManager: Enviando token al servidor...");
            const currentBuildNumber = Application.nativeBuildVersion || '0';
            const employee = await useAuthStore.getState().currentEmployee;

            // Recopilamos info útil para el backend (Opcional pero recomendado)
            const payload = {
                device_token: token,
                platform: Platform.OS, // 'android' | 'ios'
                device_model: Device.modelName || 'Unknown Device', // Ej: 'Pixel 6'
                app_version: currentBuildNumber,
                app_name: 'rndc',
                company_id: employee?.company_id || null,
            };

            // 👇 AJUSTA ESTA URL según tu ruta en Laravel (ej: /api/v1/user/device-token)
            // Usamos 'AppsApi' o la instancia que tenga los headers de autenticación
            await AppsApi.post('/messaging/v1/push/device-token', payload);

            console.log("✅ SyncManager: Token registrado exitosamente en el servidor.");

        } catch (error) {
            console.error("❌ SyncManager Error: No se pudo registrar el token en el servidor.", error);
            // No hacemos throw para no romper el flujo de la app, solo logueamos.
        }
    }

    /**
     * (Opcional) Elimina el token del servidor al cerrar sesión.
     * Esto evita que le lleguen notificaciones al usuario incorrecto.
     */
    public async unregisterDeviceToken(): Promise<void> {
        try {
            console.log("🔄 SyncManager: Eliminando token del servidor...");
            // Asumiendo que tu backend tiene un endpoint para esto
            await AppsApi.delete('/messaging/v1/push/device-token'); 
            console.log("✅ SyncManager: Token eliminado.");
        } catch (error) {
            console.error("⚠️ SyncManager: Error al desvincular token (posiblemente ya no existía).");
        }
    }
}

// Exportamos una instancia única (Singleton)
export const syncManager = new SyncManager();