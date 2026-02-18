import type { BaseModel } from './base-model';
import type { User } from './user-model';

export interface Employee extends BaseModel {
  id: number;
  identification: string;
  type_id: number | null;
  user_id: number | null;
  address: string | null;
  phone: string | null;
  birthdate: string | null;
  hire_date: string | null;
  department_id: number | null;
  department: string | null;
  emergency_contact: string | null;
  status: number;
  data: string | null;
  avatar: |{
    name: string;
    url: string;
    type:string;
  } | null;
  active: boolean;
  company_id: number;
}
