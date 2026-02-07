import { create } from 'zustand';

interface ServerState {
    isServerReachable: boolean;
    isChecking: boolean;
    serverData: any | null;
    setServerReachable: (reachable: boolean) => void;
    setChecking: (checking: boolean) => void;
    setServerData: (data: any) => void;
}

export const useServerStore = create<ServerState>((set) => ({
    isServerReachable: true,
    isChecking: false,
    serverData: null,
    setServerReachable: (reachable) => set({ isServerReachable: reachable }),
    setChecking: (checking) => set({ isChecking: checking }),
    setServerData: (data) => set({ serverData: data }),
}));
