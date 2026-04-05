import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  ImagesResponse,
  SearchResponse,
} from '../../../interfaces/browser.interface';
import { ApiBaseService } from '../api-base.service';

type SearchApiResponse = Omit<SearchResponse, 'durationMs' | 'resultCount'>;
type ImagesApiResponse = Omit<ImagesResponse, 'durationMs' | 'resultCount'>;

@Injectable({
  providedIn: 'root',
})
export class BrowserService extends ApiBaseService {
  constructor(http: HttpClient) {
    super(http);
  }

  private async timedGet<T extends { results?: unknown[] }>(
    url: string,
    query: string,
  ): Promise<T & { durationMs: number; resultCount: number }> {
    const params = new HttpParams().set('q', query);

    const start = performance.now();
    const res = await firstValueFrom(this.http.get<T>(url, { params }));
    const durationMs = Math.round(performance.now() - start);
    const resultCount = res.results?.length ?? 0;

    return {
      ...res,
      durationMs,
      resultCount,
    };
  }

  async search(query: string): Promise<SearchResponse> {
    return this.timedGet<SearchApiResponse>(
      `${this.baseUrl}/browser/search`,
      query,
    );
  }

  async images(query: string): Promise<ImagesResponse> {
    return this.timedGet<ImagesApiResponse>(
      `${this.baseUrl}/browser/images`,
      query,
    );
  }
}
