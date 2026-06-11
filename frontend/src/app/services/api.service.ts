import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = 'http://localhost:5000/api';

  constructor(private http: HttpClient) {}

  // 1. Admin Auth
  loginAdmin(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/admin/login`, credentials);
  }

  // 2. Doctors
  getDoctors(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/doctors`);
  }

  updateDoctorStatus(id: string, status: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/doctors/${id}/status`, { status });
  }

  // 3. Appointments Booking & Lists
  bookAppointment(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/appointments/book`, data);
  }

  getPendingAppointments(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/appointments/pending`);
  }

  getActiveAppointments(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/appointments/active`);
  }

  getAppointmentHistory(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/appointments/history`);
  }

  // 4. Admin Queue Controls
  acceptAppointment(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/appointments/${id}/accept`, {});
  }

  rejectAppointment(id: string, customReason: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/appointments/${id}/reject`, { customReason });
  }

  callAppointment(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/appointments/${id}/call`, {});
  }

  finishAppointment(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/appointments/${id}/finish`, {});
  }

  rescheduleAppointment(id: string, newDate: string, newTimeSlot: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/appointments/${id}/reschedule`, { newDate, newTimeSlot });
  }

  // 5. Emergency alerts
  triggerEmergency(doctorId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/doctors/${doctorId}/emergency`, {});
  }

  // 6. WhatsApp Logger
  getWhatsAppMessages(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/whatsapp/messages`);
  }
}
