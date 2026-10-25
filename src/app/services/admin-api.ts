import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { API_URL } from '../api.config';
import { Registration } from '../models/registration.model';

const STORAGE_KEY = 'iteen-admin-key';

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  // Kept for this browser tab only
  readonly apiKey = signal<string | null>(this.readStoredKey());

  setKey(key: string | null) {
    this.apiKey.set(key);
    try {
      if (key) sessionStorage.setItem(STORAGE_KEY, key);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage unavailable: key stays in memory only
    }
  }

  list() {
    return this.http.get<Registration[]>(`${API_URL}/registrations`, { headers: this.headers() });
  }

  approve(id: number) {
    return this.http.patch<Registration>(`${API_URL}/registrations/${id}/approve`, {}, {
      headers: this.headers(),
    });
  }

  reject(id: number, reason?: string) {
    return this.http.patch<Registration>(`${API_URL}/registrations/${id}/reject`, { reason }, {
        headers: this.headers(),
  });
}

  resendEmail(id: number) {
     return this.http.post<{ sent: boolean; to: string }>(
        `${API_URL}/registrations/${id}/resend-email`,
        {},
        { headers: this.headers() },
  );
}

  private headers() {
    return new HttpHeaders({ 'x-api-key': this.apiKey() ?? '' });
  }

  private readStoredKey(): string | null {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }
}