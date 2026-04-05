import { HttpClient } from '@angular/common/http';
import { environment } from '../../../enviroments/enviroment';

export abstract class ApiBaseService {
  protected readonly baseUrl = environment.backEndApiUrl;

  protected constructor(protected readonly http: HttpClient) {}
}
