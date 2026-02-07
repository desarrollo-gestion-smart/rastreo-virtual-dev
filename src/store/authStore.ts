import { create } from 'zustand';
import { type User } from '@/models/user-model';
import { type Employee } from '@/models/employee-model';
import { userService } from '@/services/UserService';
import { employeeService } from '@/services/EmployeeService';
import { companyService } from '@/services/CompanyService';
import { deviceService } from '@/services/DeviceService';
import { LocationTrackingService } from '@/services/LocationTrackingService';
import { locationHistoryService } from '@/services/LocationHistoryService';
import { pendingLocationService } from '@/services/PendingLocationService';

import { travelStatusLogService } from '@/services/TravelStatusLogService';

import { setAuthToken } from '@/api';
import axios from 'axios';




interface SyncProgress {
    status: 'idle' | 'syncing' | 'success' | 'error';
    message: string;
    currentStep: number;
    totalSteps: number;
}

interface AuthState {
    currentUser: User | null;
    currentEmployee: Employee | null;
    isAuthenticated: boolean;
    syncProgress: SyncProgress;
    isHydrated: boolean;
    hasAccess: (permission: string) => boolean;
    hydrate: () => Promise<void>;
    login: (credentials: { email: string; password: string }) => Promise<void>;
    logout: () => Promise<void>;
    syncInitialData: (user: User) => Promise<void>;
    changePassword: (passwords: {
        currentPassword: string;
        newPassword: string;
        confirmPassword: string;
    }) => Promise<{ success: boolean; message: string }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    currentUser: null,
    currentEmployee: null,
    isAuthenticated: false,
    syncProgress: {
        status: 'idle',
        message: '',
        currentStep: 0,
        totalSteps: 4,
    },
    isHydrated: false,

    hasAccess: (permission: string) => {
        const user = get().currentUser;
        if (!user?.permissions) return false;
        try {
            const permissionsObject = JSON.parse(user.permissions as string);
            return !!permissionsObject?.[permission];
        } catch {
            return false;
        }
    },

    login: async (credentials) => {
        set({ syncProgress: { status: 'syncing', message: 'Autenticando...', currentStep: 0, totalSteps: 4 } });
        try {
            const userData = await userService.login(credentials);
            set({ currentUser: userData });

            await get().syncInitialData(userData);
        } catch (error) {
            console.error('Fallo en el proceso de login:', error);
            let errorMessage = 'Error de autenticación';
            if (axios.isAxiosError(error) && error.response?.data) {
                errorMessage = (error.response.data as any).message || 'Credenciales incorrectas';
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }
            await get().logout();
            throw new Error(errorMessage);
        }
    },

    logout: async () => {
        console.log('Cerrando sesión y limpiando datos locales...');
        
        // Detener tracking antes de limpiar datos
        try {
            await LocationTrackingService.stopTracking();
        } catch (e) {
            console.warn('Error al detener tracking durante logout:', e);
        }

        await Promise.allSettled([
            userService.logout(),
            employeeService.clearAllEmployees(),
            companyService.clearAllCompanies(),
            deviceService.clearAllDevices(),

            travelStatusLogService.clearAllLogs(),
            locationHistoryService.deleteAll(),
            pendingLocationService.deleteAll(),
            
            // Limpieza de stores vía registry para evitar dependencias circulares
            (async () => {
                const { useTripStore } = require('./tripStore');
                const { useCompanyStore } = require('./companyStore');
                const { useDeviceStore } = require('./deviceStore');
                
                useTripStore.getState().clearStore();
                useCompanyStore.getState().clearStore();
                useDeviceStore.getState().clearStore();
            })(),
        ]);
        set({ currentUser: null, currentEmployee: null, isAuthenticated: false, syncProgress: { status: 'idle', message: '', currentStep: 0, totalSteps: 4 } });
        console.log('Limpieza de datos completada.');
    },

    syncInitialData: async (user: User) => {
        if (!user.id) {
            console.warn('No se puede sincronizar datos sin un ID de usuario.');
            return;
        }

        setAuthToken(user.api_token || null);

        set({ syncProgress: { status: 'syncing', message: 'Sincronizando empleados y empresas...', currentStep: 1, totalSteps: 4 } });
        try {
            await employeeService.clearAllEmployees();
            await companyService.clearAllCompanies();
            await deviceService.clearAllDevices();

            await employeeService.syncAndSaveEmployees(user.id);

            set({ syncProgress: { status: 'syncing', message: 'Sincronizando dispositivos...', currentStep: 2, totalSteps: 4 } });
            await deviceService.syncDevicesByCompanies();

            console.log("Sincronización de DB completada. Estableciendo empleado y compañía activos...");

            let activeEmployee = await employeeService.getCurrentEmployee();
            if (!activeEmployee) {
                const allEmployees = await employeeService.all();
                if (allEmployees && allEmployees.length > 0) {
                    const defaultEmployee = allEmployees[0];
                    await employeeService.setCurrentEmployee(defaultEmployee.id);
                    if (defaultEmployee.company_id) {
                        await companyService.setCurrentCompany(defaultEmployee.company_id);
                    }
                    activeEmployee = await employeeService.find(defaultEmployee.id);
                }
            } else if (activeEmployee.company_id) {
                await companyService.setCurrentCompany(activeEmployee.company_id);
            }

            set({ currentEmployee: activeEmployee });

            console.log("Actualizando stores (hidratando)...");
            const { useCompanyStore } = require('./companyStore');
            const { useDeviceStore } = require('./deviceStore');
            const { useTripStore } = require('./tripStore');
            await useCompanyStore.getState().hydrate();
            await useDeviceStore.getState().hydrate();
            // Viajes se sincronizan por demanda o notificación, no en el login inicial masivo para ahorrar tiempo,
            // pero hidratamos lo local.
            await useTripStore.getState().hydrate();

            set({ 
                isAuthenticated: true,
                syncProgress: { status: 'success', message: 'Sincronización completada', currentStep: 4, totalSteps: 4 } 
            });

        } catch (error) {
            console.error('Error durante la sincronización de datos iniciales:', error);
            set({ syncProgress: { status: 'error', message: 'Error en la sincronización', currentStep: get().syncProgress.currentStep, totalSteps: 4 } });
        }
    },

    hydrate: async () => {
        console.log('Hidratando estado desde la base de datos local...');
        let authenticated = false;
        try {
            const localUser = await userService.getActiveUser();
            if (localUser) {
                setAuthToken(localUser.api_token || null);

                let localEmployee = await employeeService.getCurrentEmployee();
                if (!localEmployee) {
                    const allEmployees = await employeeService.all();
                    if (allEmployees && allEmployees.length > 0) {
                        const defaultEmployee = allEmployees[0];
                        await employeeService.setCurrentEmployee(defaultEmployee.id);
                        if (defaultEmployee.company_id) {
                            await companyService.setCurrentCompany(defaultEmployee.company_id);
                        }
                        localEmployee = await employeeService.find(defaultEmployee.id);
                    }
                }
                if (localEmployee && localEmployee.company_id) {
                    await companyService.setCurrentCompany(localEmployee.company_id);
                }

                set({
                    currentUser: localUser,
                    currentEmployee: localEmployee,
                });
                authenticated = true;
                console.log('AuthStore hidratado parcialmente (User & Employee).');
            } else {
                setAuthToken(null);
                set({ currentUser: null, currentEmployee: null, isAuthenticated: false });
                console.log('No se encontró usuario local.');
            }

            if (authenticated) {
                // Dynamic access to avoid ReferenceError if some store is not fully initialized during authStore's module evaluation
                const { useCompanyStore } = require('./companyStore');
                const { useDeviceStore } = require('./deviceStore');
                const { useTripStore } = require('./tripStore');
                const { useTravelStatusLogStore } = require('./travelStatusLogStore');

                await useCompanyStore.getState().hydrate();
                await useDeviceStore.getState().hydrate();
                // HIDRATAMOS VIAJES
                await useTripStore.getState().hydrate();
                
                // Marcamos como autenticado SOLO después de hidratar dependencias críticas
                set({ isAuthenticated: true });
                
                // Sincronizar logs de estado pendientes
                await useTravelStatusLogStore.getState().syncPendingLogs();

                console.log('Stores dependientes hidratados.');
            }

        } catch (error) {
            console.error('Error durante la hidratación:', error);
            setAuthToken(null);
            set({ currentUser: null, currentEmployee: null, isAuthenticated: false });
        } finally {
            set({ isHydrated: true });
        }
    },
    changePassword: async (passwords:any) => {
        const { currentUser } = get();
        if (!currentUser) {
            throw new Error("No hay un usuario autenticado.");
        }

        try {
            const result = await userService.changePassword(
                currentUser.id,
                currentUser.email,
                passwords.currentPassword,
                passwords.newPassword,
                passwords.confirmPassword
            );
            return result;
        } catch (error) {
            throw error;
        }
    },
}));
