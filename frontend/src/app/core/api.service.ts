import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from './config.service';
import type { BookingRequest, EstimateRequest, RepairEstimate, ScheduleResponse } from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private config = inject(ConfigService);

  getSchedule(days = 14): Promise<ScheduleResponse> {
    return firstValueFrom(
      this.http.get<ScheduleResponse>(`${this.config.apiBaseUrl}/schedule`, { params: { days } })
    );
  }

  getEstimate(request: EstimateRequest): Promise<RepairEstimate> {
    return firstValueFrom(this.http.post<RepairEstimate>(`${this.config.apiBaseUrl}/estimate`, request));
  }

  createBooking(request: BookingRequest): Promise<{ recordId: string }> {
    return firstValueFrom(this.http.post<{ recordId: string }>(`${this.config.apiBaseUrl}/bookings`, request));
  }
}
