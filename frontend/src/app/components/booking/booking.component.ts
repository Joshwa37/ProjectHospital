import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './booking.component.html',
  styleUrl: './booking.component.css'
})
export class BookingComponent implements OnInit {
  // Form fields
  name = '';
  age: number | null = null;
  gender = '';
  phone = '';
  reason = '';
  selectedSpecialty = '';
  selectedDoctorId = '';
  appointmentDate = '';
  timeSlot = '';

  // Data helpers
  doctors: any[] = [];
  filteredDoctors: any[] = [];
  specialties: string[] = [];
  timeSlots: string[] = [
    '09:00 AM - 10:00 AM',
    '10:00 AM - 11:00 AM',
    '11:00 AM - 12:00 PM',
    '12:00 PM - 01:00 PM',
    '02:00 PM - 03:00 PM',
    '03:00 PM - 04:00 PM',
    '04:00 PM - 05:00 PM'
  ];

  // UI state
  loading = false;
  success = false;
  bookedTicket: any = null;
  errorMessage = '';

  constructor(
    private apiService: ApiService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Set default date to today
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    this.appointmentDate = `${year}-${month}-${day}`;

    // Load doctors
    this.apiService.getDoctors().subscribe({
      next: (data) => {
        this.doctors = data;
        
        // Extract unique specialties
        this.specialties = Array.from(new Set(data.map(doc => doc.specialty)));

        // Check query params if navigated from doctor card
        this.route.queryParams.subscribe(params => {
          const queryDocId = params['doctorId'];
          if (queryDocId) {
            const foundDoc = this.doctors.find(d => d._id === queryDocId);
            if (foundDoc) {
              this.selectedSpecialty = foundDoc.specialty;
              this.onSpecialtyChange();
              this.selectedDoctorId = queryDocId;
            }
          }
        });
      },
      error: (err) => {
        console.error('Error fetching doctors:', err);
        this.errorMessage = 'Could not load doctors list. Please try again.';
      }
    });
  }

  onSpecialtyChange(): void {
    this.filteredDoctors = this.doctors.filter(
      doc => doc.specialty === this.selectedSpecialty && doc.status !== 'Unavailable'
    );
    // Reset selected doctor if not in filtered list
    if (!this.filteredDoctors.find(d => d._id === this.selectedDoctorId)) {
      this.selectedDoctorId = '';
    }
  }

  onSubmit(): void {
    if (!this.name || !this.age || !this.gender || !this.phone || !this.reason || !this.selectedDoctorId || !this.appointmentDate || !this.timeSlot) {
      this.errorMessage = 'Please fill out all fields.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const bookingData = {
      name: this.name,
      age: this.age,
      gender: this.gender,
      phone: this.phone,
      reason: this.reason,
      doctorId: this.selectedDoctorId,
      date: this.appointmentDate,
      timeSlot: this.timeSlot
    };

    this.apiService.bookAppointment(bookingData).subscribe({
      next: (response) => {
        this.success = true;
        this.bookedTicket = response;
        this.loading = false;
        this.resetForm();
      },
      error: (err) => {
        console.error('Booking error:', err);
        this.errorMessage = err.error?.error || 'Appointment booking failed. Please try again.';
        this.loading = false;
      }
    });
  }

  resetForm(): void {
    this.name = '';
    this.age = null;
    this.gender = '';
    this.phone = '';
    this.reason = '';
    this.selectedSpecialty = '';
    this.selectedDoctorId = '';
    this.timeSlot = '';
  }

  bookAnother(): void {
    this.success = false;
    this.bookedTicket = null;
  }
}
