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

  signedIn = signal(false);
  admin = signal(false);

  constructor(private http: HttpClient) {
    this.signedIn.set(!!this.token);
  }

  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  private setToken(token: string | null) {
    if (token) localStorage.setItem(this.tokenKey, token);
    else localStorage.removeItem(this.tokenKey);

    this.signedIn.set(!!token);
  }

  async login(password: string): Promise<HttpResponse<LoginApiResponse>> {
    this.admin.set(false);

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
      throw err;
    }
  }

  logout() {
    this.setToken(null);
    this.admin.set(false);
  }
}
