import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  Renderer2,
  SimpleChanges,
} from '@angular/core';
import applications from '../../../data/applications.json';
import { Window } from '../../interfaces/window.interface';
import { WindowManagerService } from '../../services/window-manager.service';
import { FileNode } from '../../interfaces/file.interface';
import { ShutDownService } from '../../services/shut-down.service';
import { FormsModule } from '@angular/forms';
import { AuthenticationService } from '../../services/api/authentication/authentication.service';
import { FilesService } from '../../services/api/files/files.service';
import { firstValueFrom } from 'rxjs';

type SearchResult =
  | { kind: 'app'; application: Window }
  | { kind: 'file'; file: FileNode };

@Component({
  selector: 'app-start-menu',
  templateUrl: './start-menu.component.html',
  styleUrls: ['./start-menu.component.css'],
  imports: [FormsModule],
})
export class StartMenuComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() searchQuery: string = '';
  applications: Window[] = applications as Window[];
  fileTree: FileNode = {
    name: '',
    type: 'directory',
    children: [],
    path: '',
  };

  filteredApplications: Window[] = [];
  filteredFiles: FileNode[] = [];

  activeSearchResultIndex = -1;

  showShutDownPopup = false;
  private globalClickUnlistener!: () => void;

  @Output() closeStartMenu = new EventEmitter<null>();

  constructor(
    public windowManagerService: WindowManagerService,
    private shutdownService: ShutDownService,
    private elRef: ElementRef,
    private renderer: Renderer2,
    private authenticationService: AuthenticationService,
    private filesService: FilesService,
  ) {}

  ngOnInit(): void {
    this.applications = this.applications.filter(
      (app) =>
        app.application !== 'Media player' && app.application !== 'Photos',
    );

    void this.loadFileTree();

    this.globalClickUnlistener = this.renderer.listen(
      'document',
      'click',
      (event: MouseEvent) => {
        const clickedInside = this.elRef.nativeElement.contains(event.target);
        const clickedOnPopup = (event.target as HTMLElement).closest(
          '.show-shut-down',
        );
        if (!clickedInside || !clickedOnPopup) {
          this.showShutDownPopup = false;
        }
      },
    );
  }

  private async loadFileTree() {
    try {
      const roots = await this.fetchDirectoryChildren(null, '');
      this.fileTree = {
        name: '',
        type: 'directory',
        children: roots,
        path: '',
      };
      this.fileTree = this.removeShortcuts(this.fileTree)!;
      this.addPaths(this.fileTree, '');
    } catch {
      this.fileTree = {
        name: '',
        type: 'directory',
        children: [],
        path: '',
      };
    }
  }

  private async fetchDirectoryChildren(
    parentId: string | null,
    currentPath: string,
  ): Promise<FileNode[]> {
    const items = await firstValueFrom(
      this.filesService.listByParent(parentId),
    );

    const nodes: FileNode[] = [];
    for (const item of items) {
      const path = currentPath
        ? `${currentPath}/${item.name}`
        : `/${item.name}`;
      if (item.type === 'directory' && item._id) {
        const children = await this.fetchDirectoryChildren(item._id, path);
        nodes.push({ ...item, children, path });
      } else {
        nodes.push({ ...item, children: [], path });
      }
    }

    return nodes;
  }

  ngAfterViewInit(): void {
    // Make keyboard navigation work immediately after opening the start menu.
    queueMicrotask(() => {
      const root = this.elRef.nativeElement.querySelector(
        '.main-container',
      ) as HTMLElement | null;
      root?.focus();
    });
  }

  ngOnDestroy(): void {
    if (this.globalClickUnlistener) {
      this.globalClickUnlistener();
    }
  }

  onSearchQueryChange(value: string) {
    this.searchQuery = value;
    const query = value.trim().toLowerCase();
    if (query !== '') {
      this.filteredApplications = this.applications.filter((app) =>
        app.application.toLowerCase().includes(query),
      );
      this.filteredFiles = this.searchFiles(this.fileTree, query);
      this.resetActiveSearchResult();
    } else {
      this.filteredApplications = [];
      this.filteredFiles = [];
      this.activeSearchResultIndex = -1;
    }
  }

  onKeyDown(event: KeyboardEvent) {
    if (!this.searchQuery?.trim()) return;
    const resultsCount = this.getSearchResultsCount();
    if (resultsCount < 1) return;

    const key = event.key;

    // Move selection
    if (key === 'ArrowDown' || (key === 'Tab' && !event.shiftKey)) {
      event.preventDefault();
      this.moveActiveSearchResult(1);
      return;
    }
    if (key === 'ArrowUp' || (key === 'Tab' && event.shiftKey)) {
      event.preventDefault();
      this.moveActiveSearchResult(-1);
      return;
    }

    // Open selection
    if (key === 'Enter') {
      event.preventDefault();
      this.openActiveSearchResult();
    }
  }

  private getSearchResultsCount(): number {
    return this.filteredApplications.length + this.filteredFiles.length;
  }

  private resetActiveSearchResult(): void {
    this.activeSearchResultIndex = this.getSearchResultsCount() > 0 ? 0 : -1;
    queueMicrotask(() => this.scrollActiveSearchResultIntoView());
  }

  private moveActiveSearchResult(delta: number): void {
    const resultsCount = this.getSearchResultsCount();
    if (resultsCount < 1) {
      this.activeSearchResultIndex = -1;
      return;
    }

    const currentIndex = this.activeSearchResultIndex;
    const startIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (startIndex + delta + resultsCount) % resultsCount;
    this.activeSearchResultIndex = nextIndex;
    queueMicrotask(() => this.scrollActiveSearchResultIntoView());
  }

  private scrollActiveSearchResultIntoView(): void {
    if (this.activeSearchResultIndex < 0) return;
    const element = this.elRef.nativeElement.querySelector(
      `[data-result-index="${this.activeSearchResultIndex}"]`,
    ) as HTMLElement | null;
    element?.scrollIntoView({ block: 'nearest' });
  }

  isActiveApplication(index: number): boolean {
    return this.activeSearchResultIndex === index;
  }

  isActiveFile(index: number): boolean {
    return (
      this.activeSearchResultIndex === this.filteredApplications.length + index
    );
  }

  private getActiveSearchResult(): SearchResult | null {
    const index = this.activeSearchResultIndex;
    if (index < 0) return null;

    if (index < this.filteredApplications.length) {
      return { kind: 'app', application: this.filteredApplications[index] };
    }

    const fileIndex = index - this.filteredApplications.length;
    if (fileIndex >= 0 && fileIndex < this.filteredFiles.length) {
      return { kind: 'file', file: this.filteredFiles[fileIndex] };
    }

    return null;
  }

  openActiveSearchResult(): void {
    const result = this.getActiveSearchResult();
    if (!result) return;

    if (result.kind === 'app') {
      this.newWindow(result.application.application, result.application.icon);
      return;
    }

    this.openFile(result.file);
  }

  toggleShutDownPopup() {
    this.showShutDownPopup = !this.showShutDownPopup;
  }

  shutDown(message: string) {
    this.closeStartMenu.emit();
    this.shutdownService.shutDown(true, message);
  }

  lock() {
    this.authenticationService.logout();
  }

  removeShortcuts(node: FileNode): FileNode | null {
    if (node.type === 'shortcut') {
      return null;
    }

    const cleanedNode: FileNode = { ...node };
    if (cleanedNode.children) {
      cleanedNode.children = cleanedNode.children
        .map((child) => this.removeShortcuts(child))
        .filter((child): child is FileNode => child !== null);
    }

    return cleanedNode;
  }

  addPaths(node: FileNode, currentPath: string): void {
    node.path = currentPath ? `${currentPath}/${node.name}` : node.name;

    if (node.children) {
      for (const child of node.children) {
        this.addPaths(child, node.path);
      }
    }
  }

  newWindow(application: string, icon: string) {
    this.windowManagerService.addWindow({
      application,
      icon,
      opened: true,
      minimized: false,
    });
    this.closeStartMenu.emit();
  }

  getFileIcon(type: string): string {
    if (type === 'directory' || type === 'shortcut') return 'bi-folder';
    if (type === 'md') return 'bi-file-earmark-text';
    if (type === 'png') return 'bi-image';
    if (type === 'mp3') return 'bi-music-note';
    if (type === 'mp4') return 'bi-film';
    return 'bi-file-earmark';
  }

  searchFiles(node: FileNode, query: string): FileNode[] {
    let results: FileNode[] = [];

    if (node.name.toLowerCase().includes(query)) {
      results.push(node);
    }

    if (node.children) {
      for (const child of node.children) {
        results = results.concat(this.searchFiles(child, query));
      }
    }

    return results;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['searchQuery']) {
      const query = this.searchQuery.trim().toLowerCase();
      if (query !== '') {
        this.filteredApplications = this.applications.filter((app) =>
          app.application.toLowerCase().includes(query),
        );

        this.filteredFiles = this.searchFiles(this.fileTree, query);
        this.resetActiveSearchResult();
      } else {
        this.filteredApplications = [];
        this.filteredFiles = [];
        this.activeSearchResultIndex = -1;
      }
    }
  }

  openFile(item: FileNode) {
    this.closeStartMenu.emit();
    switch (item.type) {
      case 'directory':
        this.windowManagerService.addWindow({
          application: 'Explorer',
          icon: 'bi-folder',
          data: {
            title: item.name,
            content: item.path || '',
            type: 'directory',
          },
        });
        break;

      case 'png':
        this.windowManagerService.addWindow({
          application: 'Photos',
          icon: 'bi-image',
          data: {
            title: item.name,
            content: item.url ?? item.content ?? '',
            type: 'image',
            folderId: item.parentId ?? null,
            selectedId: item._id,
            url: item.url,
          },
        });
        break;
      case 'mp4':
      case 'mp3':
        this.windowManagerService.addWindow({
          application: 'Media player',
          icon: 'bi-play-circle',
          data: {
            title: item.name,
            content: item.url ?? item.content ?? '',
            type: 'media',
            folderId: item.parentId ?? null,
            selectedId: item._id,
            url: item.url,
          },
        });
        break;
      case 'url':
        window.open(item.url ?? item.content ?? '', '_blank');
        break;
      default:
        this.windowManagerService.addWindow({
          application: 'Notepad',
          icon: 'bi-file-earmark-text',
          data: {
            title: item.name,
            content: item.content || '',
            type: 'text',
            itemId: item._id,
            parentId: item.parentId ?? null,
          },
        });
    }
  }
}
