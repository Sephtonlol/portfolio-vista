import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FileNode, FileNodeType } from '../../../interfaces/file.interface';
import { FormsModule } from '@angular/forms';
import { WindowManagerService } from '../../../services/window-manager.service';
import { Data } from '../../../interfaces/window.interface';
import { FilesStoreService } from '../../../services/files-store.service';
import { AuthenticationService } from '../../../services/api/authentication/authentication.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { ContextMenuService } from '../../../services/context-menu.service';

@Component({
  selector: 'app-explorer',
  imports: [FormsModule],
  templateUrl: './explorer.component.html',
  styleUrl: './explorer.component.css',
})
export class ExplorerComponent implements OnInit, OnDestroy {
  @Input() data!: Data | undefined;

  @ViewChild('uploadInput') uploadInput?: ElementRef<HTMLInputElement>;
  @ViewChild('inlineCreateInput')
  inlineCreateInput?: ElementRef<HTMLInputElement>;
  @ViewChild('renameInput') renameInput?: ElementRef<HTMLInputElement>;

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

  // Inline create + rename
  inlineCreateKind: 'directory' | 'md' | null = null;
  inlineCreateName = '';

  renamingId: string | null = null;
  renameValue = '';

  private childrenSub?: Subscription;

  constructor(
    private host: ElementRef<HTMLElement>,
    private windowManagerService: WindowManagerService,
    private filesStore: FilesStoreService,
    public authenticationService: AuthenticationService,
    public contextMenu: ContextMenuService,
  ) {}

  ngOnDestroy(): void {
    this.childrenSub?.unsubscribe();
  }

  @HostListener('window:resize')
  onResize() {
    this.windowWidth = window.innerWidth;
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    this.contextMenu.close();
    this.cancelInlineCreate();
    this.cancelRename();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.inlineCreateKind) return;

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      this.cancelInlineCreate();
      return;
    }

    // Don't cancel if the click was inside our inline create input/button.
    const inputEl = this.inlineCreateInput?.nativeElement;
    if (inputEl && inputEl.contains(target)) return;

    const hostEl = this.host.nativeElement;
    const buttonEl = hostEl.querySelector(
      '.explorer-inline-create button.explorer-inline-button',
    );
    if (buttonEl instanceof HTMLElement && buttonEl.contains(target)) return;

    this.cancelInlineCreate();
  }

  onBackgroundContextMenu(event: MouseEvent) {
    event.preventDefault();
    this.contextMenu.openAt(event.clientX + 2, event.clientY + 2, [
      {
        label: 'New folder',
        action: () => this.startInlineCreate('directory'),
      },
      {
        label: 'Upload file',
        action: () => this.openUpload(),
      },
      {
        label: 'New text file',
        action: () => this.startInlineCreate('md'),
      },
    ]);
  }

  onItemContextMenu(file: FileNode, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.openAt(event.clientX + 2, event.clientY + 2, [
      {
        label: 'Edit name',
        action: () => this.startRename(file),
        disabled: !file._id,
      },
      {
        label: 'Delete',
        action: () => this.deleteItem(file),
        disabled: !file._id,
      },
    ]);
  }

  openUpload() {
    this.contextMenu.close();
    this.uploadInput?.nativeElement.click();
  }

  async onUploadSelected(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    if (!file) return;

    // Reset so selecting the same file twice still triggers change.
    input!.value = '';

    const mime = file.type || '';
    const type: FileNodeType | null = mime.startsWith('image/')
      ? 'png'
      : mime.startsWith('video/')
        ? 'mp4'
        : mime.startsWith('audio/')
          ? 'mp3'
          : null;

    if (!type) return;

    const name = this.stripExtension(file.name).trim();
    if (!name) return;

    try {
      const dataUrl = await this.readFileAsDataUrl(file);

      await this.filesStore.create({
        name,
        type,
        parentId: this.currentFolderId,
        url: dataUrl,
      });
    } catch (err) {
      this.handleAuthError(err);
    }
  }

  private stripExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot <= 0) return filename;
    return filename.slice(0, lastDot);
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.readAsDataURL(file);
    });
  }

  startInlineCreate(kind: 'directory' | 'md') {
    this.contextMenu.close();
    this.cancelRename();
    this.inlineCreateKind = kind;
    this.inlineCreateName = '';

    window.setTimeout(() => {
      this.inlineCreateInput?.nativeElement.focus();
    }, 0);
  }

  cancelInlineCreate() {
    this.inlineCreateKind = null;
    this.inlineCreateName = '';
  }

  onListClick(event: MouseEvent) {
    this.contextMenu.close();

    if (!this.inlineCreateKind) return;

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      this.cancelInlineCreate();
      return;
    }

    const inInlineCreateRow = !!target.closest('.explorer-inline-create');
    const inInlineCreateInput = !!target.closest(
      '.explorer-inline-create input.explorer-inline-input',
    );
    const inInlineCreateButton = !!target.closest(
      '.explorer-inline-create button.explorer-inline-button',
    );

    // Cancel by clicking anywhere except the inline input or Create button.
    if (inInlineCreateInput || inInlineCreateButton) return;
    if (inInlineCreateRow) {
      this.cancelInlineCreate();
      return;
    }

    this.cancelInlineCreate();
  }

  async confirmInlineCreate() {
    if (!this.inlineCreateKind) return;
    const name = this.inlineCreateName.trim();
    if (!name) return;

    try {
      await this.filesStore.create({
        name,
        type: this.inlineCreateKind,
        parentId: this.currentFolderId,
        content: this.inlineCreateKind === 'md' ? '' : undefined,
      });
      this.cancelInlineCreate();
    } catch (err) {
      this.handleAuthError(err);
    }
  }

  startRename(file: FileNode) {
    if (!file._id) return;
    this.contextMenu.close();
    this.cancelInlineCreate();
    this.renamingId = file._id;
    this.renameValue = file.name;

    window.setTimeout(() => {
      this.renameInput?.nativeElement.focus();
      this.renameInput?.nativeElement.select();
    }, 0);
  }

  cancelRename() {
    this.renamingId = null;
    this.renameValue = '';
  }

  async confirmRename() {
    const id = this.renamingId;
    if (!id) return;
    const name = this.renameValue.trim();
    if (!name) return;

    try {
      await this.filesStore.update(id, { name });
      this.cancelRename();
    } catch (err) {
      this.handleAuthError(err);
    }
  }

  async deleteItem(file: FileNode) {
    if (!file._id) return;
    this.contextMenu.close();
    this.cancelRename();
    this.cancelInlineCreate();
    try {
      await this.filesStore.delete(file._id);
    } catch (err) {
      this.handleAuthError(err);
    }
  }

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

  onOpenItem(file: FileNode) {
    if (this.inlineCreateKind) return;
    if (file._id && this.renamingId === file._id) return;
    this.openItem(file);
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
    this.childrenSub?.unsubscribe();
    this.items = [];

    this.childrenSub = this.filesStore
      .children$(this.currentFolderId)
      .subscribe((children) => {
        this.items = children;
      });

    await this.filesStore.refresh(this.currentFolderId);
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
      const children: FileNode[] = await this.filesStore.list(currentId);
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
