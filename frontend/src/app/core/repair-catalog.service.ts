import { Injectable } from '@angular/core';
import type { RepairCatalog } from './models';

@Injectable({ providedIn: 'root' })
export class RepairCatalogService {
  private catalog?: RepairCatalog;

  async load(): Promise<RepairCatalog> {
    if (this.catalog) return this.catalog;
    const res = await fetch('/repair-catalog.json', { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Failed to load /repair-catalog.json (${res.status})`);
    }
    this.catalog = (await res.json()) as RepairCatalog;
    return this.catalog;
  }
}
