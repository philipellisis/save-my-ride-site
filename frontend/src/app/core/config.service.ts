import { Injectable } from '@angular/core';

interface RuntimeConfig {
  apiBaseUrl: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private config: RuntimeConfig = { apiBaseUrl: '' };

  async load(): Promise<void> {
    const res = await fetch('/config.json', { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Failed to load /config.json (${res.status})`);
    }
    this.config = (await res.json()) as RuntimeConfig;
  }

  get apiBaseUrl(): string {
    return this.config.apiBaseUrl;
  }
}
