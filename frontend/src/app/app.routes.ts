import { Routes } from '@angular/router';
import { LandingComponent } from './components/landing/landing.component';
import { AdminComponent } from './components/admin/admin.component';
import { BookingComponent } from './components/booking/booking.component';
import { TokensComponent } from './components/tokens/tokens.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'admin', component: AdminComponent },
  { path: 'book', component: BookingComponent },
  { path: 'tokens', component: TokensComponent },
  { path: '**', redirectTo: '' }
];
