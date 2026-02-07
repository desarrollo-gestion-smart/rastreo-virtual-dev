import { BaseService } from '../database/BaseService';
import { Employee } from '../models/employee-model';
import { AppsApi } from '../api';
import { companyService } from './CompanyService';

const EMPLOYEE_TABLE = 'employees';
const EMPLOYEE_FIELDS: (keyof Employee)[] =[
   'id',
  'identification',
  'type_id',
  'user_id',
  'address',
  'phone',
  'birthdate',
  'hire_date',
  'department_id',
  'department',
  'emergency_contact',
  'status',
  'data',
  'avatar',
  'active',
  'company_id'
]
export class EmployeeService extends BaseService<Employee> {
  constructor() {
    super(EMPLOYEE_TABLE, EMPLOYEE_FIELDS);
  }

   public async syncAndSaveEmployees(userId: number): Promise<void> {
         try {
            // 1. Llama a la API para obtener la lista completa de empleados

            await this.clearAllEmployees();
            await companyService.clearAllCompanies();

            const filter: any = {
                user_id: userId,
                status: 1,
            };
            const response = await AppsApi.get(`/rh/v1/employees`, {
                params: {
                    filter: JSON.stringify(filter),
                    page: 1,
                    take: 20
                }
            });
            const employeesFromApi: Employee[] = response.data.data;
            if (!employeesFromApi || employeesFromApi.length === 0) {
                throw new Error('No se encontraron empleados para el usuario proporcionado.');
            }

            // 2. CORRECCIÓN: Extraer los IDs de las empresas y sincronizarlas ANTES de guardar los empleados
            const companyIds = [...new Set(employeesFromApi.map(emp => emp.company_id).filter(id => id != null))] as number[];

            if (companyIds.length > 0) {
                await companyService.syncAndSaveCompanies(companyIds);
            }

            // 3. Limpia los registros de empleados locales existentes
            await this.clearAllEmployees();

            // 4. Guarda los nuevos registros de empleados en la base de datos local
            for (const employee of employeesFromApi) {
                await this.create(employee);
            }

            console.log(`${employeesFromApi.length} empleados y sus empresas asociadas han sido sincronizados.`);

        } catch (error) {
            console.error('Error al sincronizar los empleados:', error);
            throw error;
        }
    }

    /**
     * Establece un empleado como el "activo" en la base de datos local.
     * @param employeeId - El ID del empleado a marcar como activo.
     */
    public async setCurrentEmployee(employeeId: number): Promise<void> {
        try {
            await this.db.withTransactionAsync(async () => {
                // Primero, desactiva a todos los empleados
                     await this.updateAll({ active: false });
                // Luego, activa solo al empleado seleccionado
                 await this.update(employeeId, { active: true });
            });
            console.log(`Empleado con ID ${employeeId} establecido como activo.`);
        } catch (error) {
            console.error('Error al establecer el empleado activo:', error);
            throw error;
        }
    }

    /**
     * Obtiene el empleado actualmente marcado como activo desde la DB local.
     */
    public async getCurrentEmployee(): Promise<Employee | null> {
        return this.findByAttributes({ active: true } as Partial<Employee>);
    }

    /**
     * Elimina todos los empleados de la base de datos local. Útil para el logout.
     */
    public async clearAllEmployees(): Promise<void> {
        await this.destroy();
    }

}

export const employeeService = new EmployeeService();
