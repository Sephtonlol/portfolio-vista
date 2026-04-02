import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../enviroments/enviroment';
import {
  ImagesResponse,
  SearchResponse,
} from '../../interfaces/browser.interface';

type SearchApiResponse = Omit<SearchResponse, 'durationMs' | 'resultCount'>;
type ImagesApiResponse = Omit<ImagesResponse, 'durationMs' | 'resultCount'>;

@Injectable({
  providedIn: 'root',
})
export class BrowserService {
  private baseUrl = environment.backEndApiUrl;

  constructor(private http: HttpClient) {}

  async search(query: string): Promise<SearchResponse> {
    const params = new HttpParams().set('q', query);

    const start = performance.now();
    const res = await firstValueFrom(
      this.http.get<SearchApiResponse>(`${this.baseUrl}/browser/search`, {
        params,
      }),
    );
    const durationMs = Math.round(performance.now() - start);
    const resultCount = res.results?.length ?? 0;

    return {
      ...res,
      durationMs,
      resultCount,
    };
  }

  async images(query: string): Promise<ImagesResponse> {
    const params = new HttpParams().set('q', query);

    const start = performance.now();
    const res = await firstValueFrom(
      this.http.get<ImagesApiResponse>(`${this.baseUrl}/browser/images`, {
        params,
      }),
    );
    const durationMs = Math.round(performance.now() - start);
    const resultCount = res.results?.length ?? 0;

    return {
      ...res,
      durationMs,
      resultCount,
    };
  }
}
