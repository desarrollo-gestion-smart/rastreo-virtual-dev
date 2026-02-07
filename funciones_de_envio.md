El sistema de envío de datos está centralizado en el servicio `EjetrackService`, que gestiona tanto el envío inmediato como la sincronización de datos pendientes acumulados por falta de conexión.

### 1. Ubicación de Funciones y Servicios
Las funciones principales se encuentran en los siguientes archivos:

*   **`src/services/EjetrackService.ts`**: Es el motor principal de comunicación.
    *   `sendLocation(payload)`: Intenta el envío prioritario del punto actual. Si falla, lo guarda en la base de datos local como "pendiente".
    *   `sendLocationsBatch(payloads)`: Envía grupos de hasta 100 puntos en una sola petición HTTP para optimizar el uso de red.
    *   `processPendingLocations()`: Gestiona la cola de pendientes con lógica de reintento, "backoff" (espera incremental tras fallos) y validación de tiempo/cantidad.
*   **`src/services/LocationTrackingService.ts`**: Gestiona la captura del GPS.
    *   Aquí se define `LOCATION_TRACKING_TASK`, que captura la ubicación cada 6 segundos y llama a `EjetrackService.sendLocation`.
*   **`src/services/LocationHistoryService.ts`**: Encargado de la persistencia en la base de datos local SQLite (tabla `location_history`), asegurando que ningún dato se pierda aunque no haya internet.
*   **`src/services/BackgroundSyncService.ts`**: Registra una tarea de sistema (`BACKGROUND_SYNC_LOCATIONS`) que se ejecuta cada 15 minutos para intentar enviar datos pendientes incluso si la aplicación está cerrada o el usuario no está en una ruta activa.

### 2. Flujo de Envío de Datos
1.  **Captura:** El GPS obtiene una coordenada.
2.  **Envío Prioritario:** Se intenta enviar inmediatamente al servidor.
3.  **Persistencia:** Independientemente del éxito, el punto se guarda en SQLite. Si el envío falló, se marca como `synced = 0`.
4.  **Sincronización por Lotes:** Si se acumulan 100 puntos o pasan más de 2 minutos con datos pendientes, el sistema dispara un envío masivo (`batch`) para limpiar la cola eficientemente.

### 3. Sugerencias de Optimización
Para mejorar el rendimiento y la fiabilidad del envío, se pueden considerar las siguientes acciones:

*   **Compresión de Lotes (Gzip):** Si los lotes de 100 puntos resultan en payloads grandes, habilitar compresión Gzip en las peticiones `POST` para reducir el consumo de datos móviles.
*   **Ajuste Dinámico de Intervalos:** Actualmente el GPS captura datos cada 6 segundos. Se podría implementar una lógica que aumente este intervalo (ej. a 15-20 segundos) cuando el vehículo esté detenido o la batería esté por debajo del 20%.
*   **Priorización de Eventos Críticos:** Asegurar que eventos como "Inicio de Ruta" o "Botón de Pánico" (si existen) ignoren las colas de espera y se envíen con un timeout más corto y reintentos más agresivos.
*   **Validación de Calidad de Señal:** Antes de intentar un envío individual, verificar no solo si hay internet, sino la latencia o el tipo de red (WiFi vs Celular) para decidir si es mejor guardar localmente y esperar a una mejor conexión para el envío por lotes.
*   **Limpieza Automática (Housekeeping):** Implementar una función que elimine registros sincronizados de la base de datos local que tengan más de 30 días, para evitar que el archivo de base de datos crezca indefinidamente.