import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../enviroments/enviroment';
import {
  ImagesResponse,
  SearchResponse,
} from '../../interfaces/browser.interface';

@Injectable({
  providedIn: 'root',
})
export class BrowserService {
  private baseUrl = environment.backEndApiUrl;

  constructor(private http: HttpClient) {}

  async search(query: string): Promise<SearchResponse> {
    const params = new HttpParams().set('q', query);
    return await firstValueFrom(
      this.http.get<SearchResponse>(`${this.baseUrl}/browser/search`, {
        params,
      }),
    );
  }

  async images(query: string): Promise<ImagesResponse> {
    const params = new HttpParams().set('q', query);
    return await firstValueFrom(
      this.http.get<ImagesResponse>(`${this.baseUrl}/browser/images`, {
        params,
      }),
    );
  }
}
