import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Category, CreateRegistration, Registration } from '../models/registration.model';
import { API_URL } from '../api.config';

@Injectable({ providedIn: 'root' })
export class RegistrationApi {
  private readonly http = inject(HttpClient);

  getCategories() {
    return this.http.get<Category[]>(`${API_URL}/categories`);
  }

  submit(body: CreateRegistration) {
    return this.http.post<Registration>(`${API_URL}/registrations`, body);
  }
}