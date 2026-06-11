import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { SocketService } from '../../services/socket.service';

@Component({
  selector: 'app-tokens',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tokens.component.html',
  styleUrl: './tokens.component.css'
})
export class TokensComponent implements OnInit, OnDestroy {
  // Queue Data
  activeConsultations: any[] = [];
  nextUpQueue: any[] = [];

  // Clock
  currentTime = new Date();
  private clockInterval: any;

  // Fullscreen State
  isFullscreen = false;

  // Flash highlight state
  recentlyCalledToken: number | null = null;
  recentlyCalledDoctorId: string | null = null;

  constructor(
    private apiService: ApiService,
    private socketService: SocketService
  ) {}

  ngOnInit(): void {
    this.loadQueueData();

    // Update clock every second
    this.clockInterval = setInterval(() => {
      this.currentTime = new Date();
    }, 1000);

    // Socket: Live token announcements
    this.socketService.onEvent('token-called').subscribe((data: any) => {
      // 1. Play synthetic chime buzzer
      this.playChime();

      // 2. TTS announcement (wait slightly for chime to play)
      setTimeout(() => {
        this.speakToken(data.tokenNumber, data.cabinNumber);
      }, 800);

      // 3. Set flashing highlight
      this.recentlyCalledToken = data.tokenNumber;
      this.recentlyCalledDoctorId = data.doctorName; // or doctor ID if we had it, name is fine
      
      // Clear highlight after 10 seconds
      setTimeout(() => {
        if (this.recentlyCalledToken === data.tokenNumber) {
          this.recentlyCalledToken = null;
          this.recentlyCalledDoctorId = null;
        }
      }, 10000);

      // Re-load the lists to get updated status immediately
      this.loadQueueData();
    });

    // Socket: General updates
    this.socketService.onEvent('queue-updated').subscribe(() => {
      this.loadQueueData();
    });

    this.socketService.onEvent('token-finished').subscribe(() => {
      this.loadQueueData();
    });

    // Listen for fullscreen change events (e.g. if user presses Esc)
    document.addEventListener('fullscreenchange', this.onFullscreenChange.bind(this));
  }

  ngOnDestroy(): void {
    if (this.clockInterval) {
      clearInterval(this.clockInterval);
    }
    document.removeEventListener('fullscreenchange', this.onFullscreenChange.bind(this));
  }

  loadQueueData(): void {
    this.apiService.getActiveAppointments().subscribe({
      next: (data) => {
        // Active consultations = status is 'In Consultation'
        this.activeConsultations = data.filter(appt => appt.status === 'In Consultation');
        
        // Next up queue = status is 'Confirmed' or 'Rescheduled'
        // Sorted by tokenNumber (ascending)
        this.nextUpQueue = data.filter(appt => appt.status === 'Confirmed' || appt.status === 'Rescheduled')
                               .slice(0, 8); // Display next 8 patients
      },
      error: (err) => {
        console.error('Error loading active tokens:', err);
      }
    });
  }

  // Synthesis double-beep electronic chime using Web Audio API
  playChime(): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      
      const ctx = new AudioCtx();

      // Tone 1 (G5 - 784 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = 784;
      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      gain1.gain.setValueAtTime(0, ctx.currentTime);
      gain1.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.35);

      // Tone 2 (C6 - 1046 Hz) starts slightly later
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 1046.5;
      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      gain2.gain.setValueAtTime(0, ctx.currentTime + 0.25);
      gain2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.3);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.65);

      osc2.start(ctx.currentTime + 0.25);
      osc2.stop(ctx.currentTime + 0.65);
    } catch (e) {
      console.warn('AudioContext not allowed or failed:', e);
    }
  }

  // Text-To-Speech announcement using Web Speech API
  speakToken(tokenNumber: number, cabinNumber: string): void {
    if ('speechSynthesis' in window) {
      // Cancel any current speech playing
      window.speechSynthesis.cancel();

      const text = `Token number ${tokenNumber}, please proceed to ${cabinNumber}`;
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Find a suitable English voice if available
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
      
      utterance.rate = 0.85; // Slightly slower pace
      utterance.pitch = 1.0;
      
      window.speechSynthesis.speak(utterance);
    }
  }

  // Fullscreen Management
  toggleFullscreen(): void {
    const elem = document.documentElement;
    if (!this.isFullscreen) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if ((elem as any).mozRequestFullScreen) { /* Firefox */
        (elem as any).mozRequestFullScreen();
      } else if ((elem as any).webkitRequestFullscreen) { /* Chrome, Safari and Opera */
        (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).msRequestFullscreen) { /* IE/Edge */
        (elem as any).msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  }

  onFullscreenChange(): void {
    this.isFullscreen = !!document.fullscreenElement;
  }
}
