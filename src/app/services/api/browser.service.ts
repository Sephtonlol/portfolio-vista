import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
    return await firstValueFrom(
      this.http.get<SearchResponse>(`${this.baseUrl}/browser/search/${query}`),
    );
  }

  async images(query: string): Promise<ImagesResponse> {
    return await firstValueFrom(
      this.http.get<ImagesResponse>(`${this.baseUrl}/browser/images/${query}`),
    );
  }
}
