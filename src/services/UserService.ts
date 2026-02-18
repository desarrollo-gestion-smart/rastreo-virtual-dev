import axios, { AxiosError } from 'axios';
import { AppsApi, setAuthToken } from '../api';
import { BaseService } from '../database/BaseService';
// Importa el modelo desde su nueva ubicación centralizada
import { type User } from '../models/user-model';

// Constantes para claridad y fácil mantenimiento
const USER_TABLE = 'users';
const USER_FIELDS: (keyof User)[] = [
  'id',
  'first_name',
  'last_name',
  'full_name',
  'email',
  'employees',
  'avatar',
  'api_token',
  'permissions',
];

class UserService extends BaseService<User> {
    constructor() {
        // Pasa el nombre de la tabla y los campos permitidos a la clase base
        super(USER_TABLE, USER_FIELDS);
    }

    /**
     * Obtiene el usuario activo de la base de datos (asumiendo que solo hay uno).
     * @returns El objeto de usuario o null si no hay sesión activa.
     */
    public async getActiveUser(): Promise<User | null> {
        // Reutiliza el método genérico de la clase base para obtener el primer registro
        return this.findByAttributes({});
    }

     public async login(credentials: { email: string; password: string }): Promise<User> {
        try {
            // 1. Llama a la API de autenticación
            const response = await AppsApi.post('/auth/login', credentials);
            console.log('Respuesta de la API:', response.data);
            const userData: User = response.data;

            // 2. Maneja la sesión local en una transacción
            await this.db.withTransactionAsync(async () => {
                await this.destroy(); // Limpia la sesión anterior            
                await this.create(userData); // Guarda la nueva sesión
            });

            // 3. Establece el token para todas las APIs
            setAuthToken(userData.api_token || null);
            console.log('Sesión de usuario iniciada y token establecido.');
            
            return userData;
        } catch (error) {
              // MEJORA: Logueo detallado del error
            console.error('------------------------------------------');
            console.error('Error DETALLADO durante el proceso de login:');
            // Verificamos si es un error de Axios para acceder a 'response' de forma segura
            if (axios.isAxiosError(error)) {
                const axiosError = error as AxiosError;
                console.error('Es un error de Axios.');
                console.error('Status:', axiosError.response?.status);
                console.error('Data:', JSON.stringify(axiosError.response?.data, null, 2));
                console.error('Headers:', axiosError.response?.headers);
                console.error('Config:', axiosError.config);
            } else {
                 // Si no es un error de Axios, logueamos el error genérico
                console.error('No es un error de Axios.');
                console.error('Error Object:', error);
                // Intentamos loguear propiedades comunes si existen
                if (error instanceof Error) {
                     console.error('Message:', error.message);
                     console.error('Stack:', error.stack);
                }
            }
             console.error('------------------------------------------');

            console.error('Error durante el proceso de login:', error);
            // En caso de error, asegura que el estado local esté limpio.
            await this.logout();
            throw error; // Lanza el error para que el store o la UI lo manejen.
        }
    }

    /**
     * Proceso de Logout.
     * 1. Limpia la sesión del usuario en la base de datos local.
     * 2. Limpia el token de autorización de todas las APIs.
     */
    public async logout(): Promise<void> {
        try {
            // Opcional: Notificar a la API que el usuario está cerrando sesión.
            // await AppsApi.post('/auth/logout');
        } catch (error) {
            console.warn('Fallo al notificar logout a la API, procediendo con limpieza local.');
        } finally {
            await this.destroy(); // 1. Limpia la tabla de usuarios local.
            setAuthToken(null); // 2. Limpia el token de todas las instancias de API.
            console.log('Sesión de usuario cerrada y token eliminado.');
        }
    }
        public async changePassword(
        userId: number,
        email: string,
        currentPassword: string,
        newPassword: string,
        confirmPassword: string
    ): Promise<{ success: boolean; message: string }> {
        
        try {
            // 1. Validar que las contraseñas coincidan (aunque la UI ya lo hace)
            if (newPassword !== confirmPassword) {
                throw new Error('Las contraseñas nuevas no coinciden');
            }
            // (La validación de complejidad ya se hace en la UI)

            // 2. Validar contraseña actual antes de permitir el cambio
            console.log("Validando contraseña actual...");
            await AppsApi.post('auth/login', {
                email: email,
                password: currentPassword,
            }).catch(() => {
                // Si el login falla, la contraseña actual es incorrecta
                throw new Error('La contraseña Actual no coincide');
            });

            console.log("Contraseña actual validada. Enviando cambio...");
            // 3. Hacer la petición al servidor para cambiar la contraseña
            const response = await AppsApi.post(`api/user/users/${userId}/edit`, {
                password: newPassword,
                password_confirmation: confirmPassword,
            });

            if (response.status === 200) {
                return { success: true, message: 'Contraseña cambiada exitosamente' };
            } else {
                throw new Error('Error desconocido al cambiar la contraseña');
            }
            
        } catch (error: any) {
            console.error('❌ Error al cambiar contraseña:', error);

            // Manejar diferentes tipos de errores
            if (error?.response?.status === 400) {
                throw new Error('Token de sesión inválido');
            } else if (error?.response?.status === 422) {
                 // Capturamos los errores de validación del servidor
                 const errors = error.response.data?.errors;
                 if (errors && errors.password) {
                     throw new Error(errors.password[0]); // Muestra el primer error de contraseña
                 }
                throw new Error('Los datos proporcionados no son válidos');
            } else if (error.message) {
                // Esto capturará "La contraseña Actual no coincide"
                throw new Error(error.message);
            } else {
                throw new Error('Error de conexión. Intente nuevamente.');
            }
        }
    }
}

export const userService = new UserService();
