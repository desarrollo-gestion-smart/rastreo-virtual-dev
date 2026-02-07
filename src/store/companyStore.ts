import { create } from 'zustand';
import { type Company } from '../models/company-model';
import { companyService } from '../services/CompanyService';
// No registerStore needed

// Define la "forma" del estado y las acciones para las empresas
interface CompanyState {
    companies: Company[];
    currentCompany: Company | null;
    loading: boolean;
    // Actions
    hydrate: () => Promise<void>;
    setCurrentCompany: (companyId: number) => Promise<void>;
    clearStore: () => void; // NUEVA ACCIÓN AÑADIDA
}

export const useCompanyStore = create<CompanyState>((set, get) => ({
    companies: [],
    currentCompany: null,
    loading: false,

    /**
     * Hidratación: Carga todas las empresas y la empresa activa desde la base de datos local.
     */
    hydrate: async () => {
        set({ loading: true });
        try {
            const allCompanies = await companyService.all();
            const activeCompany = await companyService.getActiveCompany();
            set({
                companies: allCompanies,
                currentCompany: activeCompany,
                loading: false,
            });
            console.log('Store de empresas hidratada.');
        } catch (error) {
            console.error('Error al hidratar el store de empresas:', error);
            set({ loading: false });
        }
    },

    /**
     * Establece una nueva empresa como la activa.
     */
    setCurrentCompany: async (companyId: number) => {
        set({ loading: true });
        try {
            await companyService.setCurrentCompany(companyId);
            await get().hydrate();
        } catch (error) {
            console.error(`Error al establecer la empresa activa con ID ${companyId}:`, error);
        } finally {
            set({ loading: false });
        }
    },

    /**
     * NUEVO: Limpia el estado del store (para logout).
     */
    clearStore: () => {
        set({ companies: [], currentCompany: null, loading: false });
    },
}));

// End of file
