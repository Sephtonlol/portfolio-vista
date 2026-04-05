import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { Window } from '../interfaces/window.interface';

export type FocusedApplicationType =
  | 'system'
  | 'utility'
  | 'web'
  | 'media'
  | 'other';

@Injectable({
  providedIn: 'root',
})
export class WindowManagerService {
  private windowsSource = new BehaviorSubject<Window[]>([]);
  windows$ = this.windowsSource.asObservable();

  focusedWindow$ = this.windows$.pipe(
    map((windows) => windows.find((w) => w.focused) ?? null),
    distinctUntilChanged((a, b) => a?.id === b?.id),
  );

  focusedApplication$ = this.focusedWindow$.pipe(
    map((win) => win?.application ?? null),
    distinctUntilChanged(),
  );

  private findWindow(windowId: string): Window | undefined {
    return this.windowsSource.value.find((win) => win.id === windowId);
  }

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

  updateWindow(windowId: string, patch: Partial<Window>) {
    const updated = this.windowsSource.value.map((win) =>
      win.id === windowId ? { ...win, ...patch } : win,
    );
    this.windowsSource.next(updated);
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
    const window = this.findWindow(windowId);
    return window ? !!window.opened : false;
  }

  isMinimized(windowId: string): boolean {
    const window = this.findWindow(windowId);
    return window ? !!window.minimized : false;
  }

  closeWindow(windowId: string) {
    const updated = this.windowsSource.value.filter(
      (window) => window.id !== windowId,
    );
    this.windowsSource.next(updated);
  }

  minimizeWindow(windowId: string) {
    const updated = this.windowsSource.value.map((win) =>
      win.id === windowId ? { ...win, minimized: true, focused: false } : win,
    );
    this.windowsSource.next(updated);
    this.minimizeSource.next(windowId);
  }

  closeAllWindows() {
    this.windowsSource.next([]);
  }
}
