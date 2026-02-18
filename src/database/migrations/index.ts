import {createUserTable} from './001_create_user_table';
import {createCompanyTable } from './002_create_company_table';
import {createEmployeeTable} from "./003_create_employee_table";
import { createDevicesTable } from './004_create_device_table';
import { createTravelStatusLogsTable } from './005_create_travel_status_logs_table';
import { createPendingLocationsTable } from './006_create_pending_locations_table';
import { createLocationHistoryTable } from './007_create_location_history_table';

export const ALL_MIGRATIONS = [
    createUserTable,
    createCompanyTable,
    createEmployeeTable,
    createDevicesTable,
    createTravelStatusLogsTable,
    createPendingLocationsTable,
    createLocationHistoryTable
];
