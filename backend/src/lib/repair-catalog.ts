// Synced from ../../../shared/repair-catalog.json by scripts/sync-shared.js — do not edit
// directly, edit the copy in shared/ instead (see backend/scripts/sync-shared.js for why).
import catalog from './repair-catalog.json';
import type { RepairCatalog } from '../types/domain';

export const repairCatalog = catalog as RepairCatalog;

export function findRepair(repairKey: string) {
  return repairCatalog.repairs.find((r) => r.key === repairKey);
}
