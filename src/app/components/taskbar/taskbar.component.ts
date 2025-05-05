import { Component, ElementRef, OnInit, HostListener } from '@angular/core';
import { StartMenuComponent } from '../start-menu/start-menu.component';
import { WindowManagerService } from '../../services/window-manager.service';
import { Window } from '../../interfaces/window.interface';
import applications from '../../../data/applications.json';
import { FormsModule } from '@angular/forms';

interface IndexedWindow extends Window {
  index: number;
}

@Component({
  selector: 'app-taskbar',
  standalone: true,
  imports: [StartMenuComponent, FormsModule],
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
  pinnedApps: string[] = ['Explorer', 'Terminal', 'Notepad', 'Calculator'];

  contextMenuApp: string | null = null;
  contextMenuElement: HTMLElement | null = null;

  searchQuery: string = '';

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
    this.searchQuery = '';
    this.showStartMenu = !this.showStartMenu;
  }

  newWindow(application: string, icon: string) {
    this.contextMenuApp = null;
    this.showStartMenu = false;
    this.searchQuery = '';

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
    this.showStartMenu = false;
    this.searchQuery = '';

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
    const clickedInsideStartMenu = target.closest('.start-menu');
    const clickedStartButton = target.closest('.start-button');
    const clickedSearchBar = target.closest('.search-bar');

    if (
      !clickedInsideStartMenu &&
      !clickedStartButton &&
      !clickedSearchBar &&
      this.showStartMenu
    ) {
      this.showStartMenu = false;
      this.searchQuery = '';
    }
  }

  toggleContextMenu(application: string, event: MouseEvent) {
    event.preventDefault();
    this.contextMenuApp =
      this.contextMenuApp === application ? null : application;
    this.contextMenuElement = event.target as HTMLElement;
  }

  isPinned(appName: string): boolean {
    return this.pinnedApps.includes(appName);
  }

  togglePinApp(appName: string) {
    this.contextMenuApp = null;
    this.showStartMenu = false;
    this.searchQuery = '';

    if (!this.isPinned(appName)) {
      this.pinnedApps.push(appName);
      return;
    }
    this.pinnedApps = this.pinnedApps.filter((name) => name !== appName);
  }

  allApps() {
    const active = this.groupedApps.map((e) => e[0]);
    const pinnedFirst = this.pinnedApps.concat(
      active.filter((app) => !this.pinnedApps.includes(app))
    );
    return pinnedFirst;
  }

  getWindowsByApp(appName: string) {
    return this.groupedApps.find(([name]) => name === appName)?.[1] || [];
  }

  getIcon(appName: string): string {
    const app = this.applications.find((a) => a.application === appName);
    return app?.icon || 'bi-question-circle';
  }

  onSearchChange(value: string) {
    this.searchQuery = value;
  }
}
