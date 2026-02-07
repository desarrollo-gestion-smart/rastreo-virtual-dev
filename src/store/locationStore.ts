import { create } from 'zustand';
import { LocationHistoryEntry } from '@/services/LocationHistoryService';

interface LocationState {
    locations: LocationHistoryEntry[];
    loading: boolean;
    setLocations: (locations: LocationHistoryEntry[]) => void;
    addLocation: (location: LocationHistoryEntry) => void;
    updateLocationSyncStatus: (timestamp: number, deviceId: string, synced: boolean) => void;
    setLoading: (loading: boolean) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
    locations: [],
    loading: false,
    setLocations: (locations) => set({ locations }),
    addLocation: (location) => set((state) => ({ 
        locations: [location, ...state.locations].slice(0, 200) // Mantener límite de 200
    })),
    updateLocationSyncStatus: (timestamp, deviceId, synced) => set((state) => ({
        locations: state.locations.map((loc) => 
            loc.timestamp === timestamp && loc.device_id === deviceId 
                ? { ...loc, synced } 
                : loc
        )
    })),
    setLoading: (loading) => set({ loading }),
}));
