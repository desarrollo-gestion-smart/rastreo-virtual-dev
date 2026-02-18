import axios, { type AxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios';

// 1. Crear una instancia de Axios para cada servicio con su propia URL base.
export const AppsApi = axios.create({
    baseURL: process.env.EXPO_PUBLIC_AUTH_API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

export const FormsApi = axios.create({
    baseURL: process.env.EXPO_PUBLIC_FORMS_API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

export const MantenimientoApi = axios.create({
    baseURL: process.env.EXPO_PUBLIC_FUEL_API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

export const DevApi = axios.create({
    baseURL: process.env.EXPO_PUBLIC_DEV_API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

export const TripsApi = axios.create({
    baseURL: process.env.EXPO_PUBLIC_DEV_API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

export const EjetrackApi = axios.create({
    baseURL: process.env.EXPO_PUBLIC_ROUTES_API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});
// 2. Array que agrupa todas las instancias de API.
const apiInstances = [AppsApi, FormsApi, MantenimientoApi, DevApi, TripsApi, EjetrackApi];

/**
 * Función unificada para establecer (o eliminar) el token de autorización
 * en TODAS las instancias de API a la vez.
 * @param token - El token de autenticación del usuario.
 */
export const setAuthToken = (token: string | null) => {
    // Log adicional para depuración
   // console.log(`🔑 Estableciendo token global: ${token ? '...' + token.slice(-6) : 'null'}`);
    for (const instance of apiInstances) {
        if (token) {
            instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            delete instance.defaults.headers.common['Authorization'];
        }
    }
};

// --- Interceptores para Depuración Mejorados ---

/**
 * Interceptor de Peticiones: Loguea información antes de enviar.
 */
const requestInterceptor = (config: AxiosRequestConfig): AxiosRequestConfig => {
    const url = `${config.baseURL}${config.url}`;
    console.log(`🚀 [API Request] ${config.method?.toUpperCase()} ${url}`);
    // Loguea las cabeceras para verificar el token
    console.log('  -> Headers:', JSON.stringify(config.headers, null, 2)); // Stringify para ver todo
    if (config.params) {
        console.log('  -> Params:', JSON.stringify(config.params));
    }
    if (config.data) {
        if (!(config.data instanceof FormData)) {
             console.log('  -> Payload:', JSON.stringify(config.data));
        } else {
             console.log('  -> Payload: FormData (Contenido omitido)');
        }
    }
    return config;
};

/**
 * Interceptor de Respuestas: Loguea información al recibir una respuesta exitosa.
 */
const responseInterceptor = (response: AxiosResponse): AxiosResponse => {
    const url = `${response.config.baseURL}${response.config.url}`;
    console.log(`✅ [API Response] ${response.status} ${url}`);
    return response;
};

/**
 * Manejador de Errores: Loguea errores de forma más visible y segura.
 */
const errorInterceptor = (error: AxiosError | any): Promise<AxiosError> => { // Acepta 'any' para más flexibilidad
    const config = error?.config; // Acceso seguro a config
    const url = `${config?.baseURL}${config?.url}`;
    const method = config?.method?.toUpperCase();

    console.error(`\n🚨❌ [API Error] ${method || 'Unknown Method'} ${url || 'Unknown URL'} ❌🚨`);

    // CORRECCIÓN REFORZADA: Manejo más seguro del objeto de error
    if (axios.isAxiosError(error)) {
         // Error específico de Axios
        if (error.response) {
            console.warn(`  -> Status: ${error.response.status}`);
            // Intenta mostrar el mensaje de error del servidor de forma segura
            const serverMessage = typeof error.response.data === 'object' && error.response.data !== null
                ? (error.response.data as any).message || JSON.stringify(error.response.data)
                : String(error.response.data);
            console.warn('  -> Respuesta del Servidor:', serverMessage);
            // Loguea el objeto completo para depuración si es necesario
            // console.warn('  -> Full Response Data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('  -> Error de Red: No se recibió respuesta del servidor.');
        } else {
            console.error('  -> Error de Configuración:', error.message);
        }
    } else if (error instanceof Error) {
        // Error genérico de JavaScript
        console.error('  -> Error Genérico:', error.message);
        console.error('  -> Stack:', error.stack); // El stack puede dar pistas
    } else {
        // Otro tipo de error (poco común)
        console.error('  -> Error Inesperado:', error);
    }
    console.error('🚨❌ [Fin Error API] ❌🚨\n');

    // Rechazamos la promesa con el error original
    return Promise.reject(error);
};


// Aplicamos los interceptores a CADA instancia de API
apiInstances.forEach(instance => {
    instance.interceptors.request.use(requestInterceptor as any);
    instance.interceptors.response.use(responseInterceptor, errorInterceptor);
});
// --- Fin Interceptores ---
