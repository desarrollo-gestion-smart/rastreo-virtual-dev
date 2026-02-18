import type { BaseModel } from './base-model';

export interface User extends BaseModel {
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  avatar: string | null;
  api_token: string;
  last_login: string;
  employees: string | null;
  permissions: string | null;
  devices?: string | null; // Propiedad opcional para dispositivos
}
