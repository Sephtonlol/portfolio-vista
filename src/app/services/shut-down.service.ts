import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ShutDownService {
  private shutDownSubject = new Subject<{
    isShuttingDown: boolean;
    message: string;
  }>();
  constructor() {}

  shutDown(isShuttingDown: boolean, message: string) {
    this.shutDownSubject.next({ isShuttingDown, message });
  }

  onShutDown() {
    return this.shutDownSubject.asObservable();
  }
}
