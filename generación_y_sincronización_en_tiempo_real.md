Basado en el análisis del código del proyecto, las restricciones de tiempo y cantidad para el envío de puntos (ubicaciones) están distribuidas principalmente en los servicios de rastreo y sincronización. A continuación se detallan las reglas encontradas:

### 1. Generación y Sincronización en Tiempo Real (`LocationTrackingService.ts`)
Mientras el seguimiento de una ruta está activo, el sistema decide cuándo un punto es "válido" y cuándo debe intentar enviarlo basándose en tres criterios principales:

*   **Tiempo:** Se intenta sincronizar cada **20 segundos** (`SYNC_INTERVAL_MS`).
*   **Distancia:** Se dispara un envío si el usuario se ha desplazado más de **800 metros** (`SYNC_DISTANCE_METERS`) desde el último punto sincronizado.
*   **Ángulo (Giro):** Si hay un cambio de dirección mayor a **20 grados** (`SYNC_ANGLE_DEGREES`).
*   **Precisión (Filtro):** Se descartan puntos con una precisión (accuracy) mayor a **25 metros** o que se consideren "ruido estático" (drift) si el desplazamiento es mínimo respecto a la precisión y la velocidad es baja (< 1.0 m/s).

### 2. Procesamiento de Pendientes y Lotes (`EjetrackService.ts`)
Cuando hay puntos guardados localmente que no pudieron enviarse inmediatamente, el `processPendingLocations` aplica las siguientes restricciones:

*   **Cantidad por Lote:** Los puntos se agrupan en lotes de **10 unidades** (`BATCH_SIZE`) para su envío.
*   **Disparador por Cantidad:** Si hay **10 o más** puntos pendientes, se inicia el proceso de envío automáticamente.
*   **Disparador por Tiempo:** Si hay puntos pendientes (aunque sean menos de 10) y el más antiguo tiene más de **120 segundos (2 minutos)** (`MAX_WAIT_TIME_SEC`), se fuerza el envío.
*   **Límite de Seguridad:** En un solo ciclo de sincronización, se procesan como máximo **20 bloques** de hasta 50 puntos cada uno (máximo 1000 puntos por ciclo) para evitar bucles infinitos.

### 3. Reintentos y Backoff (`EjetrackService.ts`)
Para evitar saturar el servidor o agotar la batería en caso de errores:
*   **Tiempo de Enfriamiento (Backoff):** Tras un fallo, existe un tiempo de espera (inicialmente **5 segundos**, `retryDelay`) que debe transcurrir antes de intentar otra sincronización, a menos que se fuerce manualmente.

### 4. Sincronización de Fondo (`BackgroundSyncService.ts`)
Cuando la aplicación no está en uso activo y **no hay una ruta iniciada**:
*   **Intervalo Mínimo:** La tarea de fondo se registra para ejecutarse cada **15 minutos** (el mínimo permitido por los sistemas operativos).
*   **Condiciones de Omisión:** La tarea no se ejecuta si el usuario no está autenticado, si ya hay un seguimiento de ruta activo, o si no hay datos pendientes.

### Resumen de Valores Clave
| Parámetro | Valor        | Archivo |
| :--- |:-------------| :--- |
| Intervalo de sincronización (Ruta) | 20 segundos  | `LocationTrackingService.ts` |
| Distancia de disparo | 1000 metros  | `LocationTrackingService.ts` |
| Ángulo de disparo (Giro) | 30 grados    | `LocationTrackingService.ts` |
| Tamaño de lote (Batch) | 100 puntos   | `EjetrackService.ts` |
| Espera máxima puntos pendientes | 120 segundos | `EjetrackService.ts` |
| Intervalo Background Fetch | 15 minutos   | `BackgroundSyncService.ts` |
| Filtro de precisión GPS | > 25 metros  | `LocationTrackingService.ts` |