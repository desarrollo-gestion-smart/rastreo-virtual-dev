import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TrackingState {
    isTrackingActive: boolean;
    hydrate: () => Promise<void>;
    setIsTrackingActive: (active: boolean) => Promise<void>;
    clearStore: () => void;
}

const TRACKING_STORAGE_KEY = '@is_tracking_active';

export const useTripStore = create<TrackingState>((set) => ({
    isTrackingActive: false,

    hydrate: async () => {
        try {
            const storedState = await AsyncStorage.getItem(TRACKING_STORAGE_KEY);
            if (storedState !== null) {
                set({ isTrackingActive: JSON.parse(storedState) });
            }
        } catch (error) {
            console.error('Error hydrating tracking store:', error);
        }
    },

    setIsTrackingActive: async (active: boolean) => {
        try {
            await AsyncStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(active));
            set({ isTrackingActive: active });
        } catch (error) {
            console.error('Error saving tracking state:', error);
        }
    },

    clearStore: () => {
        AsyncStorage.removeItem(TRACKING_STORAGE_KEY);
        set({ isTrackingActive: false });
    }
}));
