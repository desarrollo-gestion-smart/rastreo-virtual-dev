import type { BaseModel } from './base-model';

export interface Company extends BaseModel {
  id: number;
  name: string;
  description: string | null;
  logo: |{
    name: string;
    url: string;
    type:string;
  } | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  main: string | null;
  is_active: boolean;
  settings_enables: string | null; // JSON string para configuraciones adicionales
  parent_id?: number | null;
}