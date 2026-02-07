import type { BaseModel } from './base-model';

export interface TravelStatusLog extends BaseModel {
    id: number;
    status: string;
    latitude: number;
    longitude: number;
    timestamp: string;
    synced: number;
}
