import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { SocketService } from '../../services/socket.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.css'
})
export class LandingComponent implements OnInit {
  doctors: any[] = [];
  loading = true;

  constructor(
    private apiService: ApiService,
    private socketService: SocketService
  ) {}

  ngOnInit(): void {
    this.loadDoctors();

    // Listen for doctor status changes in real-time
    this.socketService.onEvent('doctor-status-updated').subscribe((updatedDoctor: any) => {
      this.doctors = this.doctors.map(doc => 
        doc._id === updatedDoctor._id ? updatedDoctor : doc
      );
    });

    // Listen for general queue updates which might affect doctors
    this.socketService.onEvent('queue-updated').subscribe(() => {
      this.loadDoctors();
    });
  }

  loadDoctors(): void {
    this.apiService.getDoctors().subscribe({
      next: (data) => {
        this.doctors = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading doctors:', err);
        this.loading = false;
      }
    });
  }

  scrollToDoctors(): void {
    const element = document.getElementById('doctor-showcase');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Available': return 'badge-success';
      case 'On Break': return 'badge-warning';
      case 'Unavailable': return 'badge-danger';
      default: return 'badge-primary';
    }
  }
}
