import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../enviroments/enviroment';

interface LoginResponse {
  token: string;
  userId: string;
}

type LoginApiResponse = LoginResponse;

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  private baseUrl = environment.backEndApiUrl;

  signedIn = signal(false);
  admin = signal(false);

  constructor(private http: HttpClient) {}

  async login(password: string): Promise<HttpResponse<LoginApiResponse>> {
    this.signedIn.set(true);
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

      this.admin.set(response.status === 200);
      return response;
    } catch (err) {
      this.admin.set(false);
      throw err;
    }
  }

  logout() {
    this.signedIn.set(false);
    this.admin.set(false);
  }
}
