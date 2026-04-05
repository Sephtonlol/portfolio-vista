import { Component, Input, OnInit } from '@angular/core';
import { FileNode, FileNodeType } from '../../../interfaces/file.interface';
import { FormsModule } from '@angular/forms';
import { WindowManagerService } from '../../../services/window-manager.service';
import { Data } from '../../../interfaces/window.interface';
import { FilesService } from '../../../services/api/files/files.service';
import { AuthenticationService } from '../../../services/api/authentication/authentication.service';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-explorer',
  imports: [FormsModule],
  templateUrl: './explorer.component.html',
  styleUrl: './explorer.component.css',
})
export class ExplorerComponent implements OnInit {
  @Input() data!: Data | undefined;

  currentFolderId: string | null = null;
  currentPath: string[] = []; // folder names from root
  private folderIdStack: (string | null)[] = [null];

  items: FileNode[] = [];
  searchTerm: string = '';
  pathInput: string = '';
  windowWidth = window.innerWidth;

  viewList = true;

  pathHistory: string[] = ['/'];
  historyIndex: number = 0;

  // Admin-only create UI
  showContextMenu = false;
  contextX = 0;
  contextY = 0;

  showCreateDialog = false;
  createKind: 'menu' | FileNodeType = 'menu';
  newName = '';
  newUrl = '';

  onContextMenu(event: MouseEvent) {
    if (!this.authenticationService.admin()) return;
    event.preventDefault();
    this.contextX = event.clientX;
    this.contextY = event.clientY;
    this.showContextMenu = true;
  }

  closeContextMenu() {
    this.showContextMenu = false;
  }

  openCreate(kind: FileNodeType) {
    if (!this.authenticationService.admin()) return;
    this.closeContextMenu();
    this.createKind = kind;
    this.newName = '';
    this.newUrl = '';
    this.showCreateDialog = true;
  }

  cancelCreate() {
    this.showCreateDialog = false;
    this.createKind = 'menu';
    this.newName = '';
    this.newUrl = '';
  }

  async confirmCreate() {
    if (!this.authenticationService.admin()) return;
    if (this.createKind === 'menu') return;

    const name = this.newName.trim();
    if (!name) return;

    try {
      const created = await firstValueFrom(
        this.filesService.create({
          name,
          type: this.createKind,
          parentId: this.currentFolderId,
          content: this.createKind === 'md' ? '' : undefined,
          url:
            this.createKind === 'png' || this.createKind === 'url'
              ? this.newUrl.trim() || undefined
              : undefined,
        }),
      );

      this.cancelCreate();
      await this.loadChildren();

      // For new markdown docs, open Notepad right away.
      if (created.type === 'md') {
        this.windowManagerService.addWindow({
          application: 'Notepad',
          icon: 'bi-file-earmark-text',
          data: {
            title: created.name,
            content: created.content || '',
            type: 'text',
            itemId: created._id,
            parentId: created.parentId ?? this.currentFolderId,
          },
        });
      }
    } catch (err) {
      this.handleAuthError(err);
    }
  }

  constructor(
    private windowManagerService: WindowManagerService,
    private filesService: FilesService,
    public authenticationService: AuthenticationService,
  ) {}

  ngOnInit(): void {
    // Prefer folderId if provided; otherwise resolve a path string.
    if (this.data?.folderId !== undefined) {
      this.currentFolderId = this.data.folderId;
      this.folderIdStack = [null];
      if (this.currentFolderId) this.folderIdStack.push(this.currentFolderId);
      this.currentPath = [];
      this.pathInput = '/';
      void this.loadChildren();
      return;
    }

    const initialPath = this.data?.content ? String(this.data.content) : '';
    this.pathInput = initialPath
      ? initialPath.startsWith('/')
        ? initialPath
        : '/' + initialPath
      : '/';
    void this.goToTypedPath();
  }

  async goUp() {
    if (this.currentPath.length > 0) {
      this.currentPath.pop();
      this.folderIdStack.pop();
      this.currentFolderId =
        this.folderIdStack[this.folderIdStack.length - 1] ?? null;
      this.pathInput = '/' + this.currentPath.join('/');
      this.searchTerm = '';
      this.updatePathHistory(this.pathInput);
      await this.loadChildren();
    }
  }

  resetPathInput() {
    this.pathInput = '/' + this.currentPath.join('/');
  }

  updatePathHistory(newPath: string): void {
    if (this.historyIndex < this.pathHistory.length - 1) {
      this.pathHistory = this.pathHistory.slice(0, this.historyIndex + 1);
    }
    this.pathHistory.push(newPath);
    this.historyIndex = this.pathHistory.length - 1;
  }

  goBack(): void {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      void this.navigateToPath(this.pathHistory[this.historyIndex]);
    }
  }

  goForward(): void {
    if (this.historyIndex < this.pathHistory.length - 1) {
      this.historyIndex++;
      void this.navigateToPath(this.pathHistory[this.historyIndex]);
    }
  }

  async navigateToPath(path: string): Promise<void> {
    this.pathInput = path || '/';
    await this.goToTypedPath(false);
  }

  get filteredChildren(): FileNode[] {
    return (this.items || [])
      .filter((child) =>
        child.name.toLowerCase().includes(this.searchTerm.toLowerCase()),
      )
      .sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
      });
  }

  getFileIcon(type: string): string {
    switch (type) {
      case 'directory':
      case 'shortcut':
        return 'bi-folder';
      case 'md':
        return 'bi-file-earmark-text';
      case 'png':
        return 'bi-image';
      case 'mp3':
        return 'bi-music-note';
      case 'mp4':
        return 'bi-film';
      case 'url':
        return 'bi-link-45deg';
      default:
        return 'bi-file-earmark';
    }
  }

  displayName(file: FileNode): string {
    if (
      file.type === 'directory' ||
      file.type === 'shortcut' ||
      file.type === 'url'
    ) {
      return file.name;
    }

    if (file.name.toLowerCase().endsWith(`.${file.type}`)) return file.name;
    return `${file.name}.${file.type}`;
  }

  openItem(file: FileNode) {
    if (file.type === 'directory') {
      if (!file._id) return;
      this.currentPath.push(file.name);
      this.folderIdStack.push(file._id);
      this.currentFolderId = file._id;

      const newPath = '/' + this.currentPath.join('/');
      this.pathInput = newPath;
      this.searchTerm = '';
      this.updatePathHistory(newPath);
      void this.loadChildren();
      return;
    }
    if (file.type === 'shortcut') {
      const shortcutTarget = file.shortcutTo ?? file.content;
      if (!shortcutTarget)
        return console.error('Failed to open shortcut location');

      if (shortcutTarget.startsWith('/')) {
        this.pathInput = shortcutTarget;
        void this.goToTypedPath();
        return;
      }

      // If the backend stores shortcutTo as an id, we can navigate to that folder id,
      // but we cannot reconstruct the full path without extra endpoints.
      this.currentFolderId = shortcutTarget;
      this.folderIdStack = [null, shortcutTarget];
      this.currentPath = [];
      this.pathInput = '/';
      void this.loadChildren();
      return;
    }

    switch (file.type) {
      case 'png':
        this.windowManagerService.addWindow({
          application: 'Photos',
          icon: 'bi-image',
          data: {
            title: file.name,
            content: file.url ?? file.content ?? '',
            type: 'image',
            folderId: this.currentFolderId,
            selectedId: file._id,
            url: file.url,
          },
        });
        break;
      case 'mp4':
      case 'mp3':
        this.windowManagerService.addWindow({
          application: 'Media player',
          icon: 'bi-play-circle',
          data: {
            title: file.name,
            content: file.url ?? file.content ?? '',
            type: 'media',
            folderId: this.currentFolderId,
            selectedId: file._id,
            url: file.url,
          },
        });
        break;
      case 'url':
        window.open(file.url ?? file.content ?? '', '_blank');
        break;
      default:
        this.windowManagerService.addWindow({
          application: 'Notepad',
          icon: 'bi-file-earmark-text',
          data: {
            title: file.name,
            content: file.content || '',
            type: 'text',
            itemId: file._id,
            parentId: file.parentId ?? this.currentFolderId,
          },
        });
    }
  }

  async goToTypedPath(updateHistory = true) {
    if (this.pathInput === 'cmd') {
      this.windowManagerService.addWindow({
        application: 'Terminal',
        icon: 'bi-terminal',
        data: {
          title: 'Terminal',
          type: 'directory',
          content: [...this.currentPath].join('/'),
          folderId: this.currentFolderId,
        },
      });
      return;
    }

    const parts = (this.pathInput || '/').split('/').filter(Boolean);
    const resolution = await this.resolveFolderByPathParts(parts);
    if (!resolution) {
      this.resetPathInput();
      return;
    }

    this.currentPath = resolution.pathNames;
    this.folderIdStack = resolution.idStack;
    this.currentFolderId = resolution.folderId;
    this.pathInput = '/' + this.currentPath.join('/');
    this.searchTerm = '';

    if (updateHistory) this.updatePathHistory(this.pathInput);
    await this.loadChildren();
  }

  private async loadChildren(): Promise<void> {
    try {
      this.items = await firstValueFrom(
        this.filesService.listByParent(this.currentFolderId),
      );
    } catch (err) {
      this.items = [];
      this.handleAuthError(err);
    }
  }

  private async resolveFolderByPathParts(parts: string[]): Promise<{
    folderId: string | null;
    pathNames: string[];
    idStack: (string | null)[];
  } | null> {
    let currentId: string | null = null;
    const pathNames: string[] = [];
    const idStack: (string | null)[] = [null];

    for (const part of parts) {
      const children: FileNode[] = await firstValueFrom(
        this.filesService.listByParent(currentId),
      );
      const next: FileNode | undefined = children.find(
        (child) =>
          child.type === 'directory' && child.name === part && !!child._id,
      );
      if (!next || !next._id) return null;

      currentId = next._id;
      pathNames.push(next.name);
      idStack.push(currentId);
    }

    return { folderId: currentId, pathNames, idStack };
  }

  private handleAuthError(err: unknown) {
    if (err instanceof HttpErrorResponse && err.status === 401) {
      this.authenticationService.logout();
    }
  }
}
