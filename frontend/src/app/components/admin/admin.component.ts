import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { SocketService } from '../../services/socket.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css'
})
export class AdminComponent implements OnInit {
  // Login State
  isLoggedIn = false;
  username = '';
  password = '';
  loginError = '';

  // Dashboard Statistics
  stats = {
    activeDoctors: 0,
    pendingBookings: 0,
    waitingPatients: 0,
    completedToday: 0
  };

  // Data Arrays
  pendingRequests: any[] = [];
  activeAppointments: any[] = [];
  historyAppointments: any[] = [];
  doctors: any[] = [];
  whatsappLogs: any[] = [];

  // Active Tab
  activeTab = 'pending'; // 'pending', 'active', 'history'

  // Modal State - Rejection
  showRejectModal = false;
  selectedApptForReject: any = null;
  customRejectionReason = '';

  // Modal State - Reschedule
  showRescheduleModal = false;
  selectedApptForReschedule: any = null;
  newRescheduleDate = '';
  newRescheduleTimeSlot = '';
  timeSlots: string[] = [
    '09:00 AM - 10:00 AM',
    '10:00 AM - 11:00 AM',
    '11:00 AM - 12:00 PM',
    '12:00 PM - 01:00 PM',
    '02:00 PM - 03:00 PM',
    '03:00 PM - 04:00 PM',
    '04:00 PM - 05:00 PM'
  ];

  constructor(
    private apiService: ApiService,
    private socketService: SocketService
  ) {}

  ngOnInit(): void {
    // Check local storage for existing session
    const token = localStorage.getItem('admin_token');
    if (token) {
      this.isLoggedIn = true;
      this.initDashboard();
    }
  }

  handleLogin(): void {
    this.loginError = '';
    this.apiService.loginAdmin({ username: this.username, password: this.password }).subscribe({
      next: (res) => {
        localStorage.setItem('admin_token', res.token);
        this.isLoggedIn = true;
        this.initDashboard();
      },
      error: (err) => {
        console.error('Login failed:', err);
        this.loginError = 'Invalid username or password.';
      }
    });
  }

  handleLogout(): void {
    localStorage.removeItem('admin_token');
    this.isLoggedIn = false;
    this.resetState();
  }

  resetState(): void {
    this.username = '';
    this.password = '';
    this.pendingRequests = [];
    this.activeAppointments = [];
    this.historyAppointments = [];
    this.doctors = [];
    this.whatsappLogs = [];
  }

  initDashboard(): void {
    this.loadPending();
    this.loadActive();
    this.loadHistory();
    this.loadDoctors();
    this.loadWhatsAppLogs();

    // Set up Socket listeners for real-time changes
    this.socketService.onEvent('new-appointment-request').subscribe((newRequest: any) => {
      this.pendingRequests = [newRequest, ...this.pendingRequests];
      this.updateStats();
    });

    this.socketService.onEvent('queue-updated').subscribe(() => {
      this.loadPending();
      this.loadActive();
      this.loadHistory();
    });

    this.socketService.onEvent('doctor-status-updated').subscribe(() => {
      this.loadDoctors();
    });

    this.socketService.onEvent('new-simulated-whatsapp').subscribe((message: any) => {
      this.whatsappLogs = [message, ...this.whatsappLogs];
    });
  }

  // Loading Functions
  loadPending(): void {
    this.apiService.getPendingAppointments().subscribe(data => {
      this.pendingRequests = data;
      this.updateStats();
    });
  }

  loadActive(): void {
    this.apiService.getActiveAppointments().subscribe(data => {
      this.activeAppointments = data;
      this.updateStats();
    });
  }

  loadHistory(): void {
    this.apiService.getAppointmentHistory().subscribe(data => {
      this.historyAppointments = data;
      this.updateStats();
    });
  }

  loadDoctors(): void {
    this.apiService.getDoctors().subscribe(data => {
      this.doctors = data;
      this.updateStats();
    });
  }

  loadWhatsAppLogs(): void {
    this.apiService.getWhatsAppMessages().subscribe(data => {
      this.whatsappLogs = data;
    });
  }

  updateStats(): void {
    this.stats.activeDoctors = this.doctors.filter(d => d.status === 'Available').length;
    this.stats.pendingBookings = this.pendingRequests.length;
    this.stats.waitingPatients = this.activeAppointments.filter(a => a.status === 'Confirmed' || a.status === 'Rescheduled').length;
    
    // Calculate Completed Today
    this.stats.completedToday = this.historyAppointments.filter(a => a.status === 'Completed').length;
  }

  // Queue Operations
  acceptRequest(id: string): void {
    this.apiService.acceptAppointment(id).subscribe(() => {
      this.loadPending();
      this.loadActive();
    });
  }

  openRejectModal(appt: any): void {
    this.selectedApptForReject = appt;
    this.customRejectionReason = `Dr. ${appt.doctor.name} is unavailable at your chosen time. Please book another slot.`;
    this.showRejectModal = true;
  }

  closeRejectModal(): void {
    this.showRejectModal = false;
    this.selectedApptForReject = null;
    this.customRejectionReason = '';
  }

  submitReject(): void {
    if (!this.selectedApptForReject) return;
    this.apiService.rejectAppointment(this.selectedApptForReject._id, this.customRejectionReason).subscribe(() => {
      this.closeRejectModal();
      this.loadPending();
      this.loadHistory();
    });
  }

  callPatient(id: string): void {
    this.apiService.callAppointment(id).subscribe(() => {
      this.loadActive();
    });
  }

  finishConsultation(id: string): void {
    this.apiService.finishAppointment(id).subscribe(() => {
      this.loadActive();
      this.loadHistory();
    });
  }

  openRescheduleModal(appt: any): void {
    this.selectedApptForReschedule = appt;
    this.newRescheduleDate = appt.date;
    this.newRescheduleTimeSlot = appt.timeSlot;
    this.showRescheduleModal = true;
  }

  closeRescheduleModal(): void {
    this.showRescheduleModal = false;
    this.selectedApptForReschedule = null;
  }

  submitReschedule(): void {
    if (!this.selectedApptForReschedule) return;
    this.apiService.rescheduleAppointment(
      this.selectedApptForReschedule._id,
      this.newRescheduleDate,
      this.newRescheduleTimeSlot
    ).subscribe(() => {
      this.closeRescheduleModal();
      this.loadActive();
    });
  }

  updateDocStatus(id: string, event: Event): void {
    const status = (event.target as HTMLSelectElement).value;
    this.apiService.updateDoctorStatus(id, status).subscribe(() => {
      this.loadDoctors();
    });
  }

  triggerDoctorEmergency(id: string): void {
    this.apiService.triggerEmergency(id).subscribe((res) => {
      alert(`Emergency Broadcast successfully triggered! ${res.alertedCount} waiting patients notified via WhatsApp.`);
      this.loadActive();
    });
  }
}
