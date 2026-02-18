import { BaseService } from '../database/BaseService';
import { type Device } from '../models/device-model';
import { AppsApi, MantenimientoApi } from '../api';
import { companyService } from './CompanyService';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const DEVICE_TABLE = 'devices';
const DEVICE_FIELDS: (keyof Device)[] = [
    'id', 'name', 'plate', 'device_id', 'data',
    'image_link', 'options', 'company_id', 'active', 'created_at', 'updated_at'
];

export class DeviceService extends BaseService<Device> {
    constructor() {
        super(DEVICE_TABLE, DEVICE_FIELDS);
    }

    /**
     * Sincroniza todos los dispositivos asociados a las empresas guardadas localmente.
     */
    public async syncDevicesByCompanies(): Promise<void> {
        try {
            const allCompanies = await companyService.all();
            if (!allCompanies || allCompanies.length === 0) {
                console.log('No hay empresas locales, no se pueden sincronizar dispositivos.');
                return;
            }
            const companyIds = allCompanies.map(c => c.id);

            await this.clearAllDevices();
            console.log('Iniciando sincronización paginada de dispositivos...');
            await this._syncDevicesRecursive(companyIds);
            console.log('Sincronización de dispositivos completada.');

        } catch (error) {
            console.error('Error durante la sincronización de dispositivos:', error);
            throw error;
        }
    }

    private async _syncDevicesRecursive(companyIds: number[], page = 1): Promise<void> {
        const filter = { company_id: companyIds, status: 1 };
        const response = await MantenimientoApi.get('/devices/v1/devices', {
            params: {
                filter: JSON.stringify(filter),
                page: page,
                take: 50,
            }
        });

        const devicesFromApi: Device[] = response.data.data;
        const meta = response.data.meta;

        if (!devicesFromApi || devicesFromApi.length === 0) return;

        for (const device of devicesFromApi) {
            await this.create(device);
        }

        if (meta?.page?.currentPage < meta?.page?.lastPage) {
              await this.sleep(200);
            await this._syncDevicesRecursive(companyIds, page + 1);
        }
    }

    /**
     * Obtiene el dispositivo activo. Si no hay ninguno, establece el primero de la
     * empresa activa como el dispositivo por defecto.
     */
    public async getCurrentDevice(): Promise<Device | null> {
        let activeDevice = await this.findByAttributes({ active: true } as Partial<Device>);

        if (!activeDevice) {
            console.log('No se encontró un dispositivo activo. Intentando establecer uno por defecto...');
            const activeCompany = await companyService.getActiveCompany();
            if (activeCompany) {
                const companyDevices = await this.getDevicesByCompany(activeCompany.id);
                if (companyDevices && companyDevices.length > 0) {
                    const defaultDevice = companyDevices[0];
                    await this.setCurrentDevice(defaultDevice.id);
                    activeDevice = await this.find(defaultDevice.id);
                    console.log(`Dispositivo por defecto establecido: ${activeDevice?.name}`);
                }
            }
        }
        return activeDevice;
    }

    /**
     * Establece un dispositivo como el activo en la base de datos.
     */
    public async setCurrentDevice(deviceId: number): Promise<void> {
        await this.db.withTransactionAsync(async () => {
            await this.db.runAsync(`UPDATE ${this.tableName} SET active = 0 WHERE active = 1;`);
            await this.update(deviceId, { active: true } as Partial<Device>);
        });
        console.log(`Dispositivo con ID ${deviceId} establecido como activo.`);
    }

    /**
     * Obtiene todos los dispositivos para una compañía específica.
     */
    public async getDevicesByCompany(companyId: number): Promise<Device[]> {
        return this.getByAttributes({ company_id: companyId } as Partial<Device>);
    }

    /**
     * Elimina todos los dispositivos de la base de datos local.
     */
    public async clearAllDevices(): Promise<void> {
        await this.destroy();
    }
    /**
     * Sincroniza un ÚNICO dispositivo desde la API.
     * Útil para notificaciones push de tipo CREATE_DEVICE o UPDATE_DEVICE.
     */
    public async syncDeviceById(deviceId: number): Promise<void> {
        try {
            console.log(`☁️ Obteniendo datos del dispositivo ID ${deviceId} desde API...`);

            // 1. Consumir endpoint de detalle (Asumiendo estructura REST estándar)
            // Si tu API no tiene /devices/id, usa el filtro como en el sync masivo.
            const response = await MantenimientoApi.get(`/devices/v1/devices/${deviceId}`);
            
            // Verificamos si la respuesta viene directa o envuelta en 'data'
            const deviceFromApi: Device = response.data.data || response.data;

            if (!deviceFromApi || !deviceFromApi.id) {
                console.warn(`⚠️ La API no devolvió datos válidos para el dispositivo ${deviceId}`);
                return;
            }

            // 2. Upsert (Actualizar si existe, Crear si no)
            const existingDevice = await this.find(deviceId);

            if (existingDevice) {
                await this.update(deviceId, deviceFromApi);
                console.log(`✅ Dispositivo ${deviceId} actualizado localmente.`);
            } else {
                await this.create(deviceFromApi);
                console.log(`🆕 Dispositivo ${deviceId} creado localmente.`);
            }

        } catch (error) {
            console.error(`❌ Error sincronizando dispositivo ${deviceId}:`, error);
            // No lanzamos throw para no romper el flujo de la notificación, pero logueamos.
        }
    }

    /**
     * Elimina un dispositivo localmente.
     * Útil para notificaciones push de tipo DELETE_DEVICE.
     */
    public async deleteDeviceLocal(deviceId: number): Promise<void> {
        try {
            console.log(`🗑️ Eliminando dispositivo ID ${deviceId} de la base de datos local...`);
            
            // 1. Verificar si es el dispositivo activo antes de borrar
            const current = await this.getCurrentDevice();
            if (current && current.id === deviceId) {
                console.log("⚠️ El dispositivo a eliminar es el activo. Reseteando selección...");
                // Desmarcamos el activo para evitar inconsistencias en la UI
                await this.db.runAsync(`UPDATE ${this.tableName} SET active = 0 WHERE id = ?`, deviceId);
            }

            // 2. Eliminar físicamente el registro
            // Asumiendo que BaseService tiene un método delete, si no, usamos query directa:
            await this.db.runAsync(`DELETE FROM ${this.tableName} WHERE id = ?`, deviceId);
            
            console.log(`✅ Dispositivo ${deviceId} eliminado.`);

        } catch (error) {
            console.error(`❌ Error eliminando dispositivo ${deviceId}:`, error);
        }
    }
}

export const deviceService = new DeviceService();
