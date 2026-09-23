import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'schedule',
    loadComponent: () => import('./features/booking/booking.component').then((m) => m.BookingComponent),
  },
  { path: '**', redirectTo: '' },
];
