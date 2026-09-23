import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, KeyValuePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { RepairCatalogService } from '../../core/repair-catalog.service';
import { generateSlots } from '../../core/slot-generator';
import type { RepairCatalog, RepairEstimate, ScheduleResponse, TimeSlot } from '../../core/models';

type Step = 'vehicle' | 'estimate' | 'time' | 'contact' | 'success';

export const COMMON_MAKES = [
  'Toyota', 'Honda', 'Ford', 'Chevrolet', 'Nissan', 'Jeep', 'Ram', 'GMC', 'Hyundai', 'Kia',
  'Subaru', 'Volkswagen', 'BMW', 'Mercedes-Benz', 'Audi', 'Dodge', 'Chrysler', 'Buick',
  'Cadillac', 'Lincoln', 'Mazda', 'Mitsubishi', 'Acura', 'Lexus', 'Infiniti', 'Volvo', 'Tesla',
];

@Component({
  selector: 'app-booking',
  imports: [ReactiveFormsModule, CurrencyPipe, KeyValuePipe],
  templateUrl: './booking.component.html',
  styleUrl: './booking.component.scss',
})
export class BookingComponent implements OnInit {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private catalogService = inject(RepairCatalogService);

  readonly step = signal<Step>('vehicle');
  readonly errorMessage = signal<string | null>(null);
  readonly loading = signal(false);

  readonly years: number[] = Array.from({ length: new Date().getFullYear() + 1 - 1990 + 1 }, (_, i) =>
    new Date().getFullYear() + 1 - i
  );
  readonly commonMakes = COMMON_MAKES;
  readonly catalog = signal<RepairCatalog | null>(null);

  readonly estimate = signal<RepairEstimate | null>(null);
  readonly schedule = signal<ScheduleResponse | null>(null);
  readonly slots = computed<TimeSlot[]>(() => {
    const schedule = this.schedule();
    const est = this.estimate();
    if (!schedule || !est) return [];
    return generateSlots(schedule.businessHours, schedule.busyIntervals, est.estimatedHours);
  });
  readonly slotsByDay = computed<Map<string, TimeSlot[]>>(() => {
    const map = new Map<string, TimeSlot[]>();
    for (const slot of this.slots()) {
      const list = map.get(slot.dayLabel) ?? [];
      list.push(slot);
      map.set(slot.dayLabel, list);
    }
    return map;
  });
  readonly selectedSlot = signal<TimeSlot | null>(null);
  readonly bookingResult = signal<{ recordId: string } | null>(null);

  readonly vehicleForm = this.fb.nonNullable.group({
    year: [new Date().getFullYear(), Validators.required],
    make: ['', Validators.required],
    model: ['', Validators.required],
    repairKey: ['', Validators.required],
    freeformDescription: [''],
  });

  readonly contactForm = this.fb.nonNullable.group({
    customerName: ['', Validators.required],
    customerContactInfo: ['', Validators.required],
    customerAddress: [''],
  });

  get isOtherRepair(): boolean {
    return this.vehicleForm.controls.repairKey.value === 'other';
  }

  async ngOnInit(): Promise<void> {
    this.catalog.set(await this.catalogService.load());
  }

  async submitVehicleStep(): Promise<void> {
    if (this.vehicleForm.invalid) {
      this.vehicleForm.markAllAsTouched();
      return;
    }
    if (this.isOtherRepair && !this.vehicleForm.controls.freeformDescription.value.trim()) {
      this.errorMessage.set('Please describe the repair you need.');
      return;
    }

    this.errorMessage.set(null);
    this.loading.set(true);
    try {
      const { year, make, model, repairKey, freeformDescription } = this.vehicleForm.getRawValue();
      const estimate = await this.api.getEstimate({
        year,
        make,
        model,
        repairKey,
        freeformDescription: freeformDescription || undefined,
      });
      this.estimate.set(estimate);
      this.step.set('estimate');
    } catch (err) {
      this.errorMessage.set('Sorry, we could not generate an estimate right now. Please try again.');
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  async proceedToScheduling(): Promise<void> {
    this.errorMessage.set(null);
    this.loading.set(true);
    try {
      this.schedule.set(await this.api.getSchedule());
      this.step.set('time');
    } catch (err) {
      this.errorMessage.set('Sorry, we could not load the schedule right now. Please try again.');
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  selectSlot(slot: TimeSlot): void {
    this.selectedSlot.set(slot);
    this.step.set('contact');
  }

  async confirmBooking(): Promise<void> {
    if (this.contactForm.invalid || !this.selectedSlot() || !this.estimate()) {
      this.contactForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.loading.set(true);
    try {
      const { year, make, model, repairKey, freeformDescription } = this.vehicleForm.getRawValue();
      const { customerName, customerContactInfo, customerAddress } = this.contactForm.getRawValue();
      const result = await this.api.createBooking({
        customerName,
        customerContactInfo,
        customerAddress: customerAddress || undefined,
        year,
        make,
        model,
        repairKey,
        freeformDescription: freeformDescription || undefined,
        scheduledWorkDate: this.selectedSlot()!.start.toISOString(),
        estimate: this.estimate()!,
      });
      this.bookingResult.set(result);
      this.step.set('success');
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 409) {
        this.errorMessage.set('That time slot was just booked by someone else. Please pick another time.');
        this.schedule.set(await this.api.getSchedule());
        this.selectedSlot.set(null);
        this.step.set('time');
      } else {
        this.errorMessage.set('Sorry, we could not complete your booking. Please try again.');
        console.error(err);
      }
    } finally {
      this.loading.set(false);
    }
  }

  backTo(step: Step): void {
    this.errorMessage.set(null);
    this.step.set(step);
  }

  /** Keeps slotsByDay's chronological insertion order instead of the keyvalue pipe's default alpha sort. */
  originalOrder(): number {
    return 0;
  }
}
