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
    id: string;
    unminimize: boolean | null;
    drag: boolean | null;
  } | null>(null);
  focus$ = this.focusSource.asObservable();

  private minimizeSource = new BehaviorSubject<string | null>(null);
  minimize$ = this.minimizeSource.asObservable();

  addWindow(window: Window) {
    const uniqueId = `window-${Date.now()}`;
    const windowWithId = { ...window, id: uniqueId };

    const currentItems = this.windowsSource.value;
    this.windowsSource.next([...currentItems, windowWithId]);
  }

  focusWindow(windowId: string, unminimize = false, drag = false) {
    const updated = this.windowsSource.value.map((win) => ({
      ...win,
      focused: win.id === windowId,
      minimized: win.id === windowId && unminimize ? false : win.minimized,
    }));

    this.windowsSource.next(updated);
    this.focusSource.next({ id: windowId, unminimize, drag });
  }

  isOpened(windowId: string): boolean {
    const window = this.windowsSource.value.find((win) => win.id === windowId);
    return window ? !!window.opened : false;
  }

  isMinimized(windowId: string): boolean {
    const window = this.windowsSource.value.find((win) => win.id === windowId);
    return window ? !!window.minimized : false;
  }

  closeWindow(windowId: string) {
    const updated = this.windowsSource.value.filter(
      (window) => window.id !== windowId
    );
    this.windowsSource.next(updated);
  }

  minimizeWindow(windowId: string) {
    this.minimizeSource.next(windowId);
  }

  closeAllWindows() {
    this.windowsSource.next([]);
  }
}
