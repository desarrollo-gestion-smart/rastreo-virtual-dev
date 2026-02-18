import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'transmission_sin_restriccion';

interface TransmissionConfigState {
  transmissionSinRestriccion: boolean;
  isLoading: boolean;
  load: () => Promise<void>;
  setTransmissionSinRestriccion: (value: boolean) => Promise<void>;
}

export const useTransmissionConfigStore = create<TransmissionConfigState>((set, get) => ({
  transmissionSinRestriccion: false,
  isLoading: true,

  load: async () => {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEY);
      set({
        transmissionSinRestriccion: value === 'true',
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setTransmissionSinRestriccion: async (value: boolean) => {
    set({ transmissionSinRestriccion: value });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, String(value));
    } catch (e) {
      console.warn('[TransmissionConfig] Error guardando preferencia:', e);
    }
  },
}));
