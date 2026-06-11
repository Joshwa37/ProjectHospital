import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket;
  private serverUrl = 'http://localhost:5000';

  constructor() {
    this.socket = io(this.serverUrl);
  }

  // Listen for specific event
  onEvent(eventName: string): Observable<any> {
    return new Observable<any>(observer => {
      this.socket.on(eventName, (data: any) => {
        observer.next(data);
      });

      // Cleanup when unsubscribed
      return () => {
        this.socket.off(eventName);
      };
    });
  }

  // Helper method to emit custom client events if needed
  emit(eventName: string, data: any): void {
    this.socket.emit(eventName, data);
  }
}
