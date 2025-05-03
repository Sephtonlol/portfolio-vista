import { Component, ElementRef, OnInit, HostListener } from '@angular/core';
import { StartMenuComponent } from '../start-menu/start-menu.component';
import { WindowManagerService } from '../../services/window-manager.service';
import { Window } from '../../interfaces/window.interface';
import applications from '../../../data/applications.json';

interface IndexedWindow extends Window {
  index: number;
}

@Component({
  selector: 'app-taskbar',
  standalone: true,
  imports: [StartMenuComponent],
  templateUrl: './taskbar.component.html',
  styleUrls: ['./taskbar.component.css'],
})
export class TaskbarComponent implements OnInit {
  time = '';
  date = '';

  showStartMenu = false;
  windows: Window[] = [];
  groupedApps: [string, IndexedWindow[]][] = [];
  applications: Window[] = applications as Window[];

  contextMenuApp: string | null = null;
  contextMenuElement: HTMLElement | null = null;

  constructor(
    public windowManagerService: WindowManagerService,
    private eRef: ElementRef
  ) {}

  ngOnInit() {
    this.windowManagerService.windows$.subscribe((windows) => {
      this.windows = windows;
      this.groupedApps = this.groupWindowsByApplication(windows);
    });
    this.updateDateTime();
    setInterval(() => this.updateDateTime(), 1000);
  }

  private updateDateTime() {
    const now = new Date();
    this.time = now.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    this.date = now.toLocaleString('en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  toggleStartMenu() {
    this.showStartMenu = !this.showStartMenu;
  }

  newWindow(application: string, icon: string) {
    this.contextMenuApp = null;
    this.windowManagerService.addWindow({
      application,
      icon,
      opened: true,
      minimized: false,
      id: `${application}-${Date.now()}`,
    });
  }

  toggleWindow(windowId: string) {
    this.contextMenuApp = null;
    const win = this.windows.find((w) => w.id === windowId);
    if (win) {
      if (win.minimized) {
        this.windowManagerService.focusWindow(windowId, true);
      } else {
        this.windowManagerService.minimizeWindow(windowId);
      }
    }
  }

  groupWindowsByApplication(windows: Window[]): [string, IndexedWindow[]][] {
    const map = new Map<string, IndexedWindow[]>();

    windows.forEach((win, index) => {
      const winWithIndex: IndexedWindow = { ...win, index };
      const list = map.get(win.application) || [];
      list.push(winWithIndex);
      map.set(win.application, list);
    });

    return Array.from(map.entries());
  }

  isAnyInstanceOpen(windows: IndexedWindow[]): boolean {
    return windows.some((w) => !w.minimized);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;

    if (
      this.contextMenuApp &&
      !target.closest('.taskbar-popup') &&
      !target.closest('.application-outer')
    ) {
      this.contextMenuApp = null;
    }
  }

  toggleContextMenu(application: string, event: MouseEvent) {
    event.preventDefault();
    this.contextMenuApp =
      this.contextMenuApp === application ? null : application;
    this.contextMenuElement = event.target as HTMLElement;
  }
}
