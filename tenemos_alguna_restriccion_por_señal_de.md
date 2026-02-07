Sí, el sistema cuenta con mecanismos robustos para manejar la falta o intermitencia de la señal de internet. Las restricciones y comportamientos específicos son:

### 1. Verificación de Conectividad (`NetInfo`)
Antes de intentar cualquier envío de datos, el sistema consulta el estado de la red mediante la librería `NetInfo`.
*   **Condición de Aborto:** Si `isConnected` es `false` o `isInternetReachable` es `false`, el sistema **cancela el intento de envío** para ahorrar batería y recursos, manteniendo los puntos guardados localmente.
*   **Archivos involucrados:** `EjetrackService.ts` y `BackgroundSyncService.ts`.

### 2. Almacenamiento Local (Modo Offline)
Cuando no hay internet, la aplicación no pierde la información:
*   **Persistencia:** Todos los puntos generados se guardan automáticamente en una base de datos local SQLite (`location_history`) con un estado `synced = 0`.
*   **Capacidad:** Los puntos permanecen allí indefinidamente hasta que se confirme su recepción por parte del servidor.

### 3. Recuperación Automática de Señal
El sistema detecta cuándo vuelve el internet para ponerse al día:
*   **Disparador por Cambio de Red:** El hook `useServerConnection.ts` escucha cambios en el estado de internet. En el momento en que se recupera la conexión, dispara automáticamente un proceso de sincronización de los datos pendientes.
*   **Polling de Respaldo:** Cada **2 minutos**, si hay internet, se realiza un intento adicional de sincronización para asegurar que nada quede atrapado por errores temporales.

### 4. Estrategia de Reintentos (Backoff)
Si hay internet pero la señal es débil o el servidor falla:
*   **Tiempo de Enfriamiento:** Tras un fallo en el envío, el sistema aplica un "backoff" (tiempo de espera). Inicialmente es de **5 segundos** y aumenta exponencialmente hasta un máximo de **5 minutos** si los errores persisten. Esto evita saturar la conexión si la señal es inestable.
*   **Reseteo:** Una vez que un lote se envía con éxito, el contador de reintentos se reinicia a su valor base (5s).

### 5. Restricciones en Segundo Plano (Background)
Cuando la app está cerrada o en segundo plano (y no hay una ruta activa):
*   **Verificación Obligatoria:** La tarea de fondo (`BackgroundSyncService.ts`) verifica explícitamente la conexión antes de despertar otros servicios. Si no hay internet "alcanzable", la tarea termina inmediatamente para conservar energía.

### Resumen de Comportamiento
| Escenario | Acción del Sistema |
| :--- | :--- |
| **Sin Internet** | Guarda puntos en base de datos local y suspende envíos. |
| **Señal Débil (Fallo de envío)** | Aplica espera (Backoff) de 5s a 5min antes de reintentar. |
| **Recuperación de Señal** | El sistema detecta el cambio e inicia la sincronización inmediata. |
| **Intermitencia** | Usa un sistema de **lotes (batches) de 10 puntos**; si un lote falla, se detiene y espera a la próxima ventana de estabilidad. |