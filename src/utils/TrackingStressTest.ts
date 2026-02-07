import {EjetrackService} from '@/services/EjetrackService';
import {locationHistoryService} from '@/services/LocationHistoryService';
import {OsmanLocationPayload} from '@/services/EjetrackService';

export class TrackingStressTest {
    /**
     * Simula una carga de 100 puntos y disparos concurrentes para validar bloqueos.
     */
    public static async runStress(points: number = 100): Promise<void> {
        console.log(`[STRESS-TEST] 🚀 Iniciando suite de pruebas de estrés (${points} puntos)...`);

        const deviceId = "195";
        const baseTimestamp = Math.floor(Date.now() / 1000);

        // 1. Generar puntos falsos, -
        console.log(`[STRESS-TEST] 📝 Generando ${points} puntos de prueba...`);
        for (let i = 0; i < points; i++) {
            const payload: OsmanLocationPayload = {
                id: deviceId,
                lat: 4.809141 + (i * 0.001000),
                lon: -75.744680 - (i * 0.001000),
                speed: 20 + (i % 10),
                timestamp: baseTimestamp + i,
                ignition: true,
                bearing: 0,
                altitude: 2600,
                battery: 100,
                event: 0,
                power: 12,
                priority: 1
            };

            // Guardar en DB como no sincronizado
            await locationHistoryService.saveLocation(payload, false);
        }

        console.log(`[STRESS-TEST] ✅ ${points} puntos guardados en DB.`);

        // 2. Disparar 5 llamadas concurrentes a processPendingLocations
        console.log('[STRESS-TEST] 🔥 Disparando 5 llamadas concurrentes a processPendingLocations(true)...');

        const calls = [
            EjetrackService.processPendingLocations(true),
            EjetrackService.processPendingLocations(true),
            EjetrackService.processPendingLocations(true),
            EjetrackService.processPendingLocations(true),
            EjetrackService.processPendingLocations(true)
        ];

        await Promise.all(calls);

        console.log('[STRESS-TEST] ✨ Prueba de concurrencia finalizada. Revisa los logs de [SYNC-LOCK] para verificar bloqueos.');
    }
}
