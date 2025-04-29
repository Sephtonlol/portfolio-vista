import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Window } from '../interfaces/window.interface';

@Injectable({
  providedIn: 'root',
})
export class WindowManagerService {
  private windowsSource = new BehaviorSubject<Window[]>([]);
  windows$ = this.windowsSource.asObservable();

  private focusSource = new BehaviorSubject<{
    application: string;
    unminimize: boolean | null;
  } | null>(null);
  focus$ = this.focusSource.asObservable();

  private minimizeSource = new BehaviorSubject<string | null>(null);
  minimize$ = this.minimizeSource.asObservable();

  addWindow(window: Window) {
    const currentItems = this.windowsSource.value;
    this.windowsSource.next([...currentItems, window]);
  }

  focusWindow(application: string, unminimize = false) {
    this.focusSource.next({ application, unminimize });
  }

  isOpened(appName: string): boolean {
    return this.windowsSource.value.some(
      (w) => w.application === appName && w.opened
    );
  }

  isMinized(appName: string): boolean {
    return this.windowsSource.value.some(
      (w) => w.application === appName && w.minimized
    );
  }
  closeWindow(appName: string) {
    const currentItems = this.windowsSource.value.filter(
      (w) => w.application !== appName
    );
    this.windowsSource.next(currentItems);
  }
  minimizeWindow(appName: string) {
    this.minimizeSource.next(appName);
  }
}
