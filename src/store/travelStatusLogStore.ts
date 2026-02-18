import { create } from 'zustand';
import { travelStatusLogService } from '@/services/TravelStatusLogService';
import { useAuthStore } from './authStore';
import { useDeviceStore } from './deviceStore';
import * as Location from 'expo-location';
import { EjetrackService } from '@/services/EjetrackService';

interface TravelStatusLogState {
    isChangingStatus: boolean;
    syncPendingLogs: () => Promise<number>;
    clearStore: () => void;
}

export const useTravelStatusLogStore = create<TravelStatusLogState>((set) => ({
    isChangingStatus: false,

    syncPendingLogs: async () => {
        return await travelStatusLogService.syncPendingLogs();
    },

    clearStore: () => {
        set({ isChangingStatus: false });
    }
}));

// End of file
