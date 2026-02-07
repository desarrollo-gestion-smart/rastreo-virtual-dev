import { create } from 'zustand';
import { type Device } from '@/models/device-model';
import { deviceService } from '@/services/DeviceService';
import { useCompanyStore } from './companyStore';
// No registerStore needed

// Define la "forma" del estado y las acciones para los dispositivos
interface DeviceState {
    devices: Device[];
    currentDevice: Device | null;
    loading: boolean;
    // Actions
    hydrate: () => Promise<void>;
    setCurrentDevice: (deviceId: number) => Promise<void>;
    clearStore: () => void; // NUEVA ACCIÓN AÑADIDA
}

export const useDeviceStore = create<DeviceState>((set, get) => ({
    devices: [],
    currentDevice: null,
    loading: false,

    /**
     * Hidratación: Carga los dispositivos de la empresa activa y el dispositivo activo
     * desde la base de datos local.
     */
    hydrate: async () => {
        set({ loading: true });
        try {
            const activeCompany = useCompanyStore.getState().currentCompany;
            if (activeCompany) {
                const companyDevices = await deviceService.getDevicesByCompany(activeCompany.id);
                const activeDevice = await deviceService.getCurrentDevice();
                set({
                    devices: companyDevices,
                    currentDevice: activeDevice,
                });
            } else {
                set({ devices: [], currentDevice: null });
            }
            console.log('Store de dispositivos hidratada.');
        } catch (error) {
            console.error('Error al hidratar el store de dispositivos:', error);
        } finally {
            set({ loading: false });
        }
    },

    /**
     * Establece un nuevo dispositivo como el activo.
     */
    setCurrentDevice: async (deviceId: number) => {
        set({ loading: true });
        try {
            await deviceService.setCurrentDevice(deviceId);
            await get().hydrate();
        } catch (error) {
            console.error(`Error al establecer el dispositivo activo con ID ${deviceId}:`, error);
        } finally {
            set({ loading: false });
        }
    },

    /**
     * NUEVO: Limpia el estado del store (para logout).
     */
    clearStore: () => {
        set({ devices: [], currentDevice: null, loading: false });
    },
}));

// End of file
