import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../enviroments/enviroment';
import { SearchResponse } from '../../interfaces/browser.interface';

@Injectable({
  providedIn: 'root',
})
export class BrowserService {
  private baseUrl = environment.backEndApiUrl;

  constructor(private http: HttpClient) {}

  async search(query: string): Promise<SearchResponse> {
    return await firstValueFrom(
      this.http.get<SearchResponse>(`${this.baseUrl}/browser/${query}`),
    );
  }
}
