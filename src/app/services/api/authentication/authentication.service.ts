import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../enviroments/enviroment';

interface LoginResponse {
  message?: string;
  token: string;
  userId: string;
}

type LoginApiResponse = LoginResponse;

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  private baseUrl = environment.backEndApiUrl;
  private readonly tokenKey = 'pv_token';
  private readonly guestKey = 'pv_guest';

  signedIn = signal(false);
  admin = signal(false);
  guest = signal(false);

  constructor(private http: HttpClient) {
    const guest = sessionStorage.getItem(this.guestKey) === '1';
    this.guest.set(guest);
    this.updateSignedIn();
  }

  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private setToken(token: string | null) {
    if (token) localStorage.setItem(this.tokenKey, token);
    else localStorage.removeItem(this.tokenKey);

    this.updateSignedIn();
  }

  private setGuest(guest: boolean) {
    this.guest.set(guest);
    if (guest) sessionStorage.setItem(this.guestKey, '1');
    else sessionStorage.removeItem(this.guestKey);

    this.updateSignedIn();
  }

  private updateSignedIn() {
    this.signedIn.set(!!this.token || this.guest());
  }

  enterGuest() {
    this.setToken(null);
    this.admin.set(false);
    this.setGuest(true);
  }

  async login(password: string): Promise<HttpResponse<LoginApiResponse>> {
    this.admin.set(false);
    this.setGuest(false);

    const body = {
      password,
    };

    try {
      const response = await firstValueFrom(
        this.http.post<LoginApiResponse>(`${this.baseUrl}/auth/login`, body, {
          observe: 'response',
        }),
      );

      const token = response.body?.token;
      if (token) {
        this.setToken(token);
      } else {
        this.setToken(null);
        throw new Error('Login succeeded but token was missing in response.');
      }

      this.admin.set(response.status === 200);
      return response;
    } catch (err) {
      this.setToken(null);
      this.admin.set(false);
      this.setGuest(false);
      throw err;
    }
  }

  logout() {
    this.setToken(null);
    this.admin.set(false);
    this.setGuest(false);
  }
}
