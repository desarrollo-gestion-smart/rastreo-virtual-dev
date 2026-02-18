import { type SQLiteDatabase, type SQLiteRunResult, type SQLiteBindValue } from 'expo-sqlite';
import { databaseService } from './DatabaseService';
// Importamos BaseModel desde la ruta correcta (asumiendo que está en models)
import { type BaseModel } from '@/models/base-model';

export class BaseService<T extends BaseModel> {
    protected readonly db: SQLiteDatabase;
    protected readonly tableName: string;
    protected readonly allowedFields: (keyof T)[];

    constructor(tableName: string, allowedFields: (keyof T)[]) {
        this.db = databaseService.getDB();
        this.tableName = tableName;
        this.allowedFields = allowedFields;
    }

    /**
     * Función auxiliar protegida para introducir pausas.
     */
    protected sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Filtra y prepara los datos para ser insertados o actualizados en la DB.
     * Convierte objetos/arrays a strings JSON.
     */
    protected filterData(data: Partial<T>): Record<string, SQLiteBindValue> {
        const filteredData: Record<string, SQLiteBindValue> = {};
        // Añadimos 'id' a los campos permitidos si está en los datos
        const fieldsToConsider = [...this.allowedFields];
        if ('id' in data && !fieldsToConsider.includes('id')) {
            fieldsToConsider.push('id');
        }

        for (const field of fieldsToConsider) {
            if (Object.prototype.hasOwnProperty.call(data, field as string)) {
                let item: any = data[field as keyof T];
                if (Array.isArray(item) || (typeof item === 'object' && item !== null)) {
                    item = JSON.stringify(item);
                }
                // No añadimos 'undefined' a la consulta
                if (item !== undefined) {
                    filteredData[field as string] = item as SQLiteBindValue;
                }
            }
        }
        return filteredData;
    }

    /**
     * Parsea los datos recuperados de la DB.
     * Convierte strings JSON de vuelta a objetos/arrays.
     */
    protected parseData(item: T): T {
        const parsedItem = { ...item };
        for (const key in parsedItem) {
            if (Object.prototype.hasOwnProperty.call(parsedItem, key)) { // Añadimos comprobación
                const value = parsedItem[key as keyof T];
                if (typeof value === 'string') {
                    try {
                        // Parsear solo si parece JSON
                        if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
                            const parsed = JSON.parse(value);
                            (parsedItem as any)[key] = parsed;
                        }
                    } catch {
                        // No es un JSON válido, se deja como está.
                    }
                }
            }
        }
        return parsedItem;
    }

    // --- Métodos CRUD y de Consulta ---

    public async find(id: number): Promise<T | null> {
        try {
            const item = await this.db.getFirstAsync<T>(`SELECT * FROM ${this.tableName} WHERE id = ?;`, id);
            return item ? this.parseData(item) : null;
        } catch (error) {
            console.error(`Error en find para ${this.tableName}:`, error);
            return null;
        }
    }

    public async all(): Promise<T[]> {
        try {
            const items = await this.db.getAllAsync<T>(`SELECT * FROM ${this.tableName};`);
            return items.map(this.parseData);
        } catch (error) {
            console.error(`Error en all para ${this.tableName}:`, error);
            return [];
        }
    }

    /**
     * Acepta Partial<T> y maneja el ID dinámicamente.
     * Crea un nuevo registro.
     * @param data - Un objeto con los datos a insertar (puede incluir 'id' o no).
     */
    public async create(data: Partial<T>): Promise<SQLiteRunResult> {
        if (this.allowedFields.includes('created_at' as keyof T)) {
            // Si no viene en la data (es local), lo generamos. Si viene (sync), lo respetamos.
            if (data['created_at' as keyof T] === undefined) {
                (data as any)['created_at'] = this.getCurrentTimestamp();
            }
        }

        const dataToInsert = this.filterData(data);

        // Determinamos si se proporcionó un ID válido para incluirlo
        const includeId = typeof dataToInsert.id === 'number' && dataToInsert.id > 0;

        // Construimos las partes de la consulta SQL dinámicamente
        const keys = Object.keys(dataToInsert).filter(key => includeId || key !== 'id');
        const values = keys.map(key => dataToInsert[key]); // Obtenemos los valores correspondientes a las keys filtradas
        const placeholders = keys.map(() => '?').join(', ');
        const sql = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders});`;

        try {
            return await this.db.runAsync(sql, ...values);
        } catch (error) {
            console.error(`Error en create para ${this.tableName} con SQL: ${sql} y values: ${JSON.stringify(values)}`, error);
            throw error;
        }
    }

    /**
     * Inserta un registro o actualiza los datos si ya existe (Upsert).
     * ESTE ES EL MÉTODO CLAVE PARA LA SINCRONIZACIÓN DESDE EL SERVIDOR.
     * Utiliza la estrategia ON CONFLICT(id) de SQLite.
     * * @param data - Datos que incluyen obligatoriamente el ID del servidor.
     */
    public async createOrUpdate(data: Partial<T>): Promise<SQLiteRunResult> {
        const dataToProcess = this.filterData(data);

        // Validamos si tenemos un ID válido para hacer el Upsert
        const hasId = typeof dataToProcess.id === 'number' && dataToProcess.id > 0;

        // Si NO viene con ID (ej. un dato nuevo creado localmente sin sync),
        // delegamos al create normal.
        if (!hasId) {
            return this.create(data);
        }

        const keys = Object.keys(dataToProcess);
        const values = Object.values(dataToProcess);
        const placeholders = keys.map(() => '?').join(', ');

        // Construimos dinámicamente la parte del UPDATE.
        // "field1 = excluded.field1, field2 = excluded.field2"
        // 'excluded' hace referencia al valor que intentamos insertar pero falló.
        const updateSet = keys
            .filter(key => key !== 'id') // No actualizamos el ID sobre sí mismo
            .map(key => `${key} = excluded.${key}`)
            .join(', ');

        let sql = '';

        if (updateSet.length > 0) {
            // Caso normal: Insertar o Actualizar campos
            sql = `
                INSERT INTO ${this.tableName} (${keys.join(', ')}) 
                VALUES (${placeholders}) 
                ON CONFLICT(id) DO UPDATE SET ${updateSet};
            `;
        } else {
            // Caso borde: Solo viene el ID (ej. tabla de enlace simple sin más columnas)
            // Si ya existe, no hace nada.
            sql = `
                INSERT INTO ${this.tableName} (${keys.join(', ')}) 
                VALUES (${placeholders}) 
                ON CONFLICT(id) DO NOTHING;
            `;
        }

        try {
            return await this.db.runAsync(sql, ...values);
        } catch (error) {
            console.error(`Error en createOrUpdate para ${this.tableName}:`, error);
            throw error;
        }
    }

    public async update(id: number, data: Partial<Omit<T, 'id'>>): Promise<SQLiteRunResult> {
        if (this.allowedFields.includes('updated_at' as keyof T)) {
            // Siempre actualizamos updated_at en una edición local,
            // a menos que explícitamente se pase uno nuevo.
            if ((data as any)['updated_at'] === undefined) {
                (data as any)['updated_at'] = this.getCurrentTimestamp();
            }
        }
        const dataToUpdate = this.filterData(data as Partial<T>);
        delete dataToUpdate.id; // Nos aseguramos de no actualizar el ID
        const keys = Object.keys(dataToUpdate);

        if (keys.length === 0) {
            console.warn(`No hay campos válidos para actualizar en ${this.tableName} (ID: ${id})`);
            return { lastInsertRowId: 0, changes: 0 };
        }

        const values = Object.values(dataToUpdate);
        const setClause = keys.map(key => `${key} = ?`).join(', ');
        const sql = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?;`;

        try {
            return await this.db.runAsync(sql, ...values, id);
        } catch (error) {
            console.error(`Error en update para ${this.tableName}:`, error);
            throw error;
        }
    }
    public async updateAll(data: Partial<Omit<T, 'id'>>): Promise<SQLiteRunResult> {
        const dataToUpdate = this.filterData(data as Partial<T>);
        delete dataToUpdate.id; // No actualizamos el ID
        const keys = Object.keys(dataToUpdate);

        if (keys.length === 0) {
            console.warn(`No hay campos válidos para actualizar en updateAll para ${this.tableName}`);
            return { lastInsertRowId: 0, changes: 0 };
        }

        const values = Object.values(dataToUpdate);
        const setClause = keys.map(key => `${key} = ?`).join(', ');
        const sql = `UPDATE ${this.tableName} SET ${setClause};`;

        try {
            return await this.db.runAsync(sql, ...values);
        } catch (error) {
            console.error(`Error en updateAll para ${this.tableName}:`, error);
            throw error;
        }
    }
    public async delete(id: number): Promise<SQLiteRunResult> {
        return this.db.runAsync(`DELETE FROM ${this.tableName} WHERE id = ?;`, id);
    }

    public async destroy(): Promise<SQLiteRunResult> {
        return this.db.runAsync(`DELETE FROM ${this.tableName};`);
    }

    // --- CORRECCIÓN AÑADIDA ---
    /**
     * Convierte valores de JS a tipos seguros para SQLite (1/0 para boolean).
     */
    private toSqliteValue(value: any): SQLiteBindValue {
        if (typeof value === 'boolean') {
            return value ? 1 : 0; // Convertir boolean a 1 o 0
        }
        if (value === null) {
            return null;
        }
        // 'undefined' no es un valor SQLite válido, lo convertimos a null
        if (typeof value === 'undefined') {
            return null;
        }
        return value as SQLiteBindValue;
    }

    public async findByAttributes(attributes: Partial<T>): Promise<T | null> {
        // CORRECCIÓN: Filtramos keys con valores undefined
        const validKeys = Object.keys(attributes).filter(key => attributes[key as keyof T] !== undefined);

        if (validKeys.length === 0) {
            const item = await this.db.getFirstAsync<T>(`SELECT * FROM ${this.tableName} LIMIT 1;`);
            return item ? this.parseData(item) : null;
        }

        const whereClause = validKeys.map(key => `${key} = ?`).join(' AND ');
        // CORRECCIÓN: Usamos el helper para convertir los valores (ej. boolean)
        const values = validKeys.map(key => this.toSqliteValue(attributes[key as keyof T]));
        const sql = `SELECT * FROM ${this.tableName} WHERE ${whereClause} LIMIT 1;`;

        const item = await this.db.getFirstAsync<T>(sql, ...values);
        return item ? this.parseData(item) : null;
    }

    public async getByAttributes(attributes: Partial<T>): Promise<T[]> {
        // CORRECCIÓN: Filtramos keys con valores undefined
        const validKeys = Object.keys(attributes).filter(key => attributes[key as keyof T] !== undefined);

        const sql = `SELECT * FROM ${this.tableName}`;

        if (validKeys.length === 0) {
            const items = await this.db.getAllAsync<T>(sql);
            return items.map(this.parseData);
        }
        const whereClause = validKeys.map(key => `${key} = ?`).join(' AND ');
        // CORRECCIÓN: Usamos el helper para convertir los valores
        const values = validKeys.map(key => this.toSqliteValue(attributes[key as keyof T]));
        const fullSql = `${sql} WHERE ${whereClause};`;
        const items = await this.db.getAllAsync<T>(fullSql, ...values);
        return items.map(this.parseData);
    }

    public async countByAttributes(attributes: Partial<T>): Promise<number> {
        // CORRECCIÓN: Filtramos keys con valores undefined
        const validKeys = Object.keys(attributes).filter(key => attributes[key as keyof T] !== undefined);

        let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
        let values: SQLiteBindValue[] = [];

        if (validKeys.length > 0) {
            const whereClause = validKeys.map(key => `${key} = ?`).join(' AND ');
            sql += ` WHERE ${whereClause}`;
            // CORRECCIÓN: Usamos el helper para convertir los valores
            values = validKeys.map(key => this.toSqliteValue(attributes[key as keyof T]));
        }

        const result = await this.db.getFirstAsync<{ count: number }>(sql, ...values);
        return result?.count ?? 0;
    }

    protected getCurrentTimestamp(): string {
        // Creamos fecha actual
        const now = new Date();

        // Obtenemos el tiempo en milisegundos UTC
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);

        // Offset de Colombia es -5 horas
        const colombiaOffset = -5;

        // Creamos nueva fecha ajustada
        const colombiaDate = new Date(utcTime + (3600000 * colombiaOffset));

        // Formateamos manualmente para SQLite (YYYY-MM-DD HH:MM:SS)
        const year = colombiaDate.getFullYear();
        const month = String(colombiaDate.getMonth() + 1).padStart(2, '0');
        const day = String(colombiaDate.getDate()).padStart(2, '0');
        const hours = String(colombiaDate.getHours()).padStart(2, '0');
        const minutes = String(colombiaDate.getMinutes()).padStart(2, '0');
        const seconds = String(colombiaDate.getSeconds()).padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
}
