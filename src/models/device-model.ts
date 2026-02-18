import type { BaseModel } from './base-model';

export interface DeviceData {
  plate?: string;
  color?: string;
  brand?: string;
  model?: string;
  [key: string]: any;
}

export interface Device extends BaseModel {
  id: number;
  name: string;
  plate?: string; // Propiedad opcional para compatibilidad
  device_id: number | null;
  data: DeviceData | string | null;
  image_link: string | null;
  options: Record<string, any> | string | null;
  company_id: number | null;
  active: boolean | null;
}
