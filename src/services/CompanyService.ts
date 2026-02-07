import { Company } from '@/models/company-model';
import { BaseService } from '@/database/BaseService';
import { AppsApi } from '@/api';

const COMPANY_TABLE = 'companies';
const COMPANY_FIELDS: (keyof Company)[] = [
  'id',
  'name',
  'description',
  'address',
  'phone',
  'email',
  'website',
  'logo',
  'main',
  'is_active',
  'settings_enables',
  'parent_id',
];

export class CompanyService extends BaseService<Company> {
  constructor() {
    super(COMPANY_TABLE, COMPANY_FIELDS );
  }


  /**
     * Obtiene la empresa actualmente marcada como activa desde la DB local.
     */
    public async getActiveCompany(): Promise<Company | null> {
        return this.findByAttributes({ is_active: true } as Partial<Company>);
    }

  public async getCompanyById(companyId: number): Promise<Company | null> {
    return this.find(companyId);
  }

  public async getCompanies(): Promise<Company[]> {
    return this.all();
  }

   public async syncAndSaveCompanies(companyIds: number[]): Promise<void> {
        try {
            // 1. Validar y limpiar los IDs
            if (!companyIds || companyIds.length === 0) {
                console.log('No se proporcionaron IDs de empresas para sincronizar.');
                return;
            }
            // Eliminar duplicados
            const uniqueCompanyIds = [...new Set(companyIds)];

            // 2. Llama a la API para obtener la información de las empresas
            const filter = {
                ids:  uniqueCompanyIds
            };

            const response = await AppsApi.get(`/sass/v1/companies`, {
                params: {
                    filter: JSON.stringify(filter),
                    page: 1,
                    take: 50
                }
            });
            const companiesFromApi: (Company & { branch?: Company[] })[] = response.data.data;
            if (!companiesFromApi || companiesFromApi.length === 0) {
                console.log('No se encontraron empresas para los IDs proporcionados.');
                return;
            }

            // Procesar empresas y sus sucursales para crear una lista plana
            const allCompaniesMap = new Map<number, Company>();

            for (const company of companiesFromApi) {
                // Extraemos la propiedad 'branch' para no guardarla en la DB
                const { branch, ...parentCompany } = company;

               allCompaniesMap.set(parentCompany.id, parentCompany);


             if (branch && Array.isArray(branch)) {
                    for (const branchCompany of branch) {
                        // El parent_id ya viene del servidor, solo la agregamos al mapa
                       // allCompaniesMap.set(branchCompany.id, branchCompany);
                    }
                }
            }

             const allCompanies = Array.from(allCompaniesMap.values())
                                    .sort((a, b) => a.id - b.id);

            // 3. Limpia la tabla local y guarda los nuevos registros
            await this.db.withTransactionAsync(async () => {
                await this.clearAllCompanies();
               for (const company of allCompanies) {

                  await this.create(company);
                }
            });

            console.log(`${allCompanies.length} empresas (incluyendo sucursales) sincronizadas y guardadas.`);


        } catch (error) {
            console.error('Error al sincronizar las empresas:', error);
            throw error;
        }
    }

    /**
     * Establece una empresa como la "activa" en la base de datos local.
     * @param companyId - El ID de la empresa a marcar como activa.
     */
    public async setCurrentCompany(companyId: number): Promise<void> {
        try {
            await this.db.withTransactionAsync(async () => {
                // Primero, desactiva a todas las empresas
                await this.updateAll({ is_active: false } as Partial<Company>);
                // Luego, activa solo a la empresa seleccionada
                await this.update(companyId, { is_active: true } as Partial<Company>);
            });
            console.log(`Empresa con ID ${companyId} establecida como activa.`);
        } catch (error) {
            console.error('Error al establecer la empresa activa:', error);
            throw error;
        }
    }



    /**
     * Elimina todas las empresas de la base de datos local. Útil para el logout.
     */
    public async clearAllCompanies(): Promise<void> {
        await this.destroy();
    }

}

export const companyService = new CompanyService();
