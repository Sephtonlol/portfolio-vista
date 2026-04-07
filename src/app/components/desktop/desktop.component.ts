import { Component, OnDestroy, OnInit } from '@angular/core';
import { WindowManagerService } from '../../services/window-manager.service';
import { Window } from '../../interfaces/window.interface';
import { DesktopApplicationComponent } from '../desktop-application/desktop-application.component';
import { SettingsService } from '../../services/settings.service';
import { AppSettings } from '../../interfaces/settings.interface';
import { WindowComponent } from '../window/window.component';
import { FilesStoreService } from '../../services/files-store.service';
import { FileNode } from '../../interfaces/file.interface';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-desktop',
  imports: [WindowComponent, DesktopApplicationComponent],
  templateUrl: './desktop.component.html',
  styleUrl: './desktop.component.css',
})
export class DesktopComponent implements OnInit, OnDestroy {
  windows: Window[] = [];
  settings: AppSettings | null = null;

  readonly socialShortcuts: FileNode[] = [
    {
      name: 'Github',
      type: 'url',
      content: 'https://github.com/Sephtonlol/',
      url: 'https://github.com/Sephtonlol/',
    },
    {
      name: 'Linkedin',
      type: 'url',
      content: 'https://www.linkedin.com/in/alexander-wu-b63038241/',
      url: 'https://www.linkedin.com/in/alexander-wu-b63038241/',
    },
  ];

  desktopItems: FileNode[] = [];
  private desktopFolderId: string | null = null;
  private desktopSub?: Subscription;

  linkedinOpened = false;

  constructor(
    private windowManagerService: WindowManagerService,
    private settingsService: SettingsService,
    private filesStore: FilesStoreService,
  ) {}

  ngOnInit(): void {
    this.linkedinOpened = !!localStorage.getItem('linkedinOpened');
    this.windowManagerService.windows$.subscribe((windows) => {
      this.windows = windows;
    });

    this.settingsService.settings$.subscribe((settings) => {
      this.settings = settings;
    });

    void this.initDesktopItems();
  }

  ngOnDestroy(): void {
    this.desktopSub?.unsubscribe();
  }

  desktopPosition(index: number): { x: number; y: number } {
    // Windows-style layout: fill top-to-bottom, then next column.
    // Keep (0,0) and (0,1) reserved for the pinned social shortcuts.
    const gridSize = 100;

    const reservedRowsInFirstColumn = 2;
    const taskbarHeight = 56;
    const availableHeight = Math.max(0, window.innerHeight - taskbarHeight);
    const maxRows = Math.max(1, Math.floor(availableHeight / gridSize));

    const firstColumnCapacity = Math.max(
      0,
      maxRows - reservedRowsInFirstColumn,
    );

    if (index < firstColumnCapacity) {
      return { x: 0, y: index + reservedRowsInFirstColumn };
    }

    const remaining = index - firstColumnCapacity;
    const x = 1 + Math.floor(remaining / maxRows);
    const y = remaining % maxRows;
    return { x, y };
  }

  private async initDesktopItems(): Promise<void> {
    this.desktopFolderId = await this.ensureDesktopFolderId();

    if (!this.desktopFolderId) {
      this.desktopItems = [];
      return;
    }

    this.desktopSub?.unsubscribe();
    this.desktopSub = this.filesStore
      .children$(this.desktopFolderId)
      .subscribe((items) => {
        this.desktopItems = [...items].sort((a, b) => {
          if (a.type === 'directory' && b.type !== 'directory') return -1;
          if (a.type !== 'directory' && b.type === 'directory') return 1;
          return a.name.localeCompare(b.name);
        });
      });

    await this.filesStore.refresh(this.desktopFolderId);
  }

  private async ensureDesktopFolderId(): Promise<string | null> {
    const rootChildren = await this.filesStore.list(null);
    const existing = rootChildren.find(
      (c) => c.type === 'directory' && c.name.toLowerCase() === 'desktop',
    );

    if (existing?._id) return existing._id;

    const created = await this.filesStore.create({
      name: 'Desktop',
      type: 'directory',
      parentId: null,
    });
    return created._id ?? null;
  }

  openLinkedin() {
    this.linkedinOpened = true;
    localStorage.setItem('linkedinOpened', 'true');
    const linkedinUrl = 'https://www.linkedin.com/in/alexander-wu-b63038241/';
    window.open(linkedinUrl, '_blank');
  }
}
