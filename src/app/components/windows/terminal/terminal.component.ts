import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { Data } from '../../../interfaces/window.interface';
import { FileNode } from '../../../interfaces/file.interface';
import { WindowManagerService } from '../../../services/window-manager.service';
import { AuthenticationService } from '../../../services/api/authentication/authentication.service';
import { FilesStoreService } from '../../../services/files-store.service';
import {
  fileDisplayName,
  logoutOn401,
  mimeToFileNodeType,
  readFileAsDataUrl,
  stripExtension,
} from '../../../utils/file-utils';

@Component({
  selector: 'app-terminal',
  templateUrl: './terminal.component.html',
  styleUrl: './terminal.component.css',
  imports: [FormsModule],
})
export class TerminalComponent implements OnInit, AfterViewInit, OnDestroy {
  @Output() requestScrollToBottom = new EventEmitter<void>();
  @Input() id!: string | undefined;
  @Input() data!: Data | undefined;

  @ViewChild('uploadInput') uploadInput?: ElementRef<HTMLInputElement>;
  @ViewChild('commandInput') commandInput?: ElementRef<HTMLInputElement>;

  currentPath: string[] = []; // folder names
  private folderIdStack: (string | null)[] = [null];

  output: string[] = [];
  command: string = '';

  commandHistory: string[] = [];
  historyIndex: number = -1;

  mobile = false;

  private focusSub?: Subscription;

  private pendingUploadParentId: string | null = null;

  constructor(
    private windowManagerService: WindowManagerService,
    private filesStore: FilesStoreService,
    private authenticationService: AuthenticationService,
  ) {}

  ngOnInit(): void {
    const initialPath = this.data?.content ? String(this.data.content) : '';

    if (this.data?.folderId !== undefined) {
      this.folderIdStack = [null];
      if (this.data.folderId) this.folderIdStack.push(this.data.folderId);
      this.currentPath = initialPath
        ? initialPath.split('/').filter(Boolean)
        : [];
    } else if (initialPath) {
      void this.cdToPath(
        initialPath.startsWith('/') ? initialPath : '/' + initialPath,
      );
    }

    this.mobile = window.innerWidth < 922;

    this.focusSub = this.windowManagerService.focus$.subscribe((evt) => {
      if (!evt || !this.id) return;
      if (evt.id !== this.id) return;
      this.focusMainInput();
    });
  }

  ngAfterViewInit(): void {
    this.focusMainInput();
  }

  ngOnDestroy(): void {
    this.focusSub?.unsubscribe();
  }

  private focusMainInput(): void {
    if (this.mobile) return;

    setTimeout(() => {
      const input = this.commandInput?.nativeElement;
      if (!input) return;
      input.focus();
      // keep typing at the end
      try {
        input.setSelectionRange(input.value.length, input.value.length);
      } catch {
        // ignore (e.g. unsupported input types)
      }
    }, 0);
  }

  private get currentFolderId(): string | null {
    return this.folderIdStack[this.folderIdStack.length - 1] ?? null;
  }

  async handleCommand() {
    const input = this.command.trim();
    if (!input) return;

    this.commandHistory.push(input);
    this.historyIndex = this.commandHistory.length;

    this.output.push(
      `portfolio@user:~${
        this.currentPath.length ? '/' + this.currentPath.join('/') : ''
      }$ ${input}`,
    );

    const [cmd, ...args] = this.splitArgs(input);

    try {
      switch (cmd) {
        case 'ls':
          await this.list();
          break;
        case 'cd':
          await this.changeDirectory(args[0]);
          break;
        case 'pwd':
          this.output.push('/' + this.currentPath.join('/'));
          break;
        case 'echo':
          this.output.push(args.join(' '));
          break;
        case 'open':
          await this.openFile(args[0]);
          break;
        case 'cat':
          await this.cat(args[0]);
          break;
        case 'touch':
          await this.touch(args[0]);
          break;
        case 'mkdir':
          await this.mkdir(args[0]);
          break;
        case 'mv':
        case 'rename':
          await this.mv(args[0], args[1]);
          break;
        case 'rm':
        case 'del':
          await this.rm(args[0]);
          break;
        case 'upload':
          this.upload();
          break;
        case 'help':
        case '--help':
          this.showHelp();
          break;
        case 'clear':
          this.output = [];
          break;
        case 'exit':
          this.windowManagerService.closeWindow(this.id || '');
          break;
        default:
          this.output.push(
            `Unknown command: ${cmd}. Type "help" for a list of commands.`,
          );
      }
    } catch (err) {
      this.handleAuthError(err);
      this.output.push('Command failed.');
    }

    this.command = '';
    this.scrollToBottom();
  }

  private displayName(node: FileNode): string {
    return fileDisplayName(node);
  }

  private splitArgs(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let quote: '"' | "'" | null = null;

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];

      if (quote) {
        if (ch === quote) {
          quote = null;
        } else {
          current += ch;
        }
        continue;
      }

      if (ch === '"' || ch === "'") {
        quote = ch;
        continue;
      }

      if (ch === ' ') {
        if (current.length) {
          tokens.push(current);
          current = '';
        }
        continue;
      }

      current += ch;
    }

    if (current.length) tokens.push(current);
    return tokens;
  }

  private matchFile(target: string, node: FileNode): boolean {
    if (
      node.type === 'directory' ||
      node.type === 'shortcut' ||
      node.type === 'url'
    ) {
      return node.name === target;
    }

    if (node.name === target) return true;
    if (`${node.name}.${node.type}` === target) return true;

    if (target.toLowerCase().endsWith(`.${node.type}`)) {
      const base = target.slice(0, -(node.type.length + 1));
      if (base === node.name) return true;
    }

    return false;
  }

  private normalizeNameForType(raw: string, type: FileNode['type']): string {
    if (type === 'directory' || type === 'shortcut' || type === 'url') {
      return raw;
    }

    const lowerRaw = raw.toLowerCase();
    const lowerType = String(type).toLowerCase();
    const suffix = `.${lowerType}`;
    if (lowerRaw.endsWith(suffix)) {
      return raw.slice(0, -suffix.length);
    }
    return raw;
  }

  private async listChildren(parentId: string | null): Promise<FileNode[]> {
    return await this.filesStore.list(parentId);
  }

  async list() {
    try {
      const children = await this.listChildren(this.currentFolderId);
      const items = children.map((c) => this.displayName(c));
      this.output.push(items.length ? items.join(' | ') : '(empty)');
    } catch (err) {
      this.handleAuthError(err);
      this.output.push('ls: failed to load directory');
    }
  }

  async changeDirectory(path: string) {
    if (!path) {
      this.output.push('cd: missing folder name');
      return;
    }

    if (path === '/') {
      this.currentPath = [];
      this.folderIdStack = [null];
      return;
    }

    if (path.startsWith('/')) {
      await this.cdToPath(path);
      return;
    }

    const parts = path.split('/').filter((p) => p.length > 0);
    for (const part of parts) {
      if (part === '.') continue;

      if (part === '..') {
        if (this.currentPath.length === 0) {
          this.output.push('Already at root.');
          return;
        }
        this.currentPath.pop();
        this.folderIdStack.pop();
        continue;
      }

      const children = await this.listChildren(this.currentFolderId);
      const found = children.find(
        (c) =>
          (c.type === 'directory' || c.type === 'shortcut') && c.name === part,
      );

      if (!found) {
        this.output.push(`No such directory: ${part}`);
        return;
      }

      if (found.type === 'shortcut') {
        const target = found.shortcutTo ?? found.content;
        if (target?.startsWith('/')) {
          await this.cdToPath(target);
          return;
        }
        if (target) {
          this.currentPath = [];
          this.folderIdStack = [null, target];
          return;
        }
        this.output.push('cd: shortcut has no target');
        return;
      }

      if (!found._id) {
        this.output.push(`cd: directory missing id: ${part}`);
        return;
      }

      this.currentPath.push(found.name);
      this.folderIdStack.push(found._id);
    }
  }

  private async cdToPath(absolutePath: string) {
    const parts = absolutePath.split('/').filter(Boolean);
    let currentId: string | null = null;

    const nextNames: string[] = [];
    const nextIds: (string | null)[] = [null];

    for (const part of parts) {
      const children = await this.listChildren(currentId);
      const found = children.find(
        (c) => c.type === 'directory' && c.name === part && !!c._id,
      );

      if (!found || !found._id) {
        this.output.push(`cd: no such directory: ${part}`);
        return;
      }

      currentId = found._id;
      nextNames.push(found.name);
      nextIds.push(currentId);
    }

    this.currentPath = nextNames;
    this.folderIdStack = nextIds;
  }

  private async resolveFolderIdByNames(
    folderNames: string[],
  ): Promise<string | null> {
    let currentId: string | null = null;
    for (const name of folderNames) {
      const children = await this.listChildren(currentId);
      const found = children.find(
        (c) => c.type === 'directory' && c.name === name && !!c._id,
      );
      if (!found || !found._id) return null;
      currentId = found._id;
    }
    return currentId;
  }

  private async resolveFolderForPath(path: string): Promise<{
    folderId: string | null;
    folderNames: string[];
    fileName: string;
  } | null> {
    const isAbs = path.startsWith('/');
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return null;

    const fileName = parts[parts.length - 1];
    const dirParts = parts.slice(0, -1);

    let currentId: string | null = isAbs ? null : this.currentFolderId;
    const folderNames: string[] = isAbs ? [] : [...this.currentPath];

    for (const part of dirParts) {
      if (part === '.') continue;
      if (part === '..') {
        if (folderNames.length === 0) return null;
        folderNames.pop();
        currentId = await this.resolveFolderIdByNames(folderNames);
        continue;
      }

      const children = await this.listChildren(currentId);
      const next = children.find(
        (c) => c.type === 'directory' && c.name === part && !!c._id,
      );

      if (!next || !next._id) return null;
      currentId = next._id;
      folderNames.push(next.name);
    }

    return { folderId: currentId, folderNames, fileName };
  }

  async openFile(fileName: string) {
    if (!fileName) {
      this.output.push('open: missing file name');
      return;
    }

    const resolved = await this.resolveFolderForPath(fileName);
    if (!resolved) {
      this.output.push(`open: file "${fileName}" not found`);
      return;
    }

    const children = await this.listChildren(resolved.folderId);
    const file = children.find((c) => this.matchFile(resolved.fileName, c));

    if (!file) {
      this.output.push(`open: file "${resolved.fileName}" not found`);
      return;
    }

    if (file.type === 'directory') {
      if (!file._id) {
        this.output.push('open: directory missing id');
        return;
      }

      this.windowManagerService.addWindow({
        application: 'Explorer',
        icon: 'bi-folder',
        data: {
          title: file.name,
          content: '/' + [...resolved.folderNames, file.name].join('/'),
          type: 'directory',
          folderId: file._id,
        },
      });
      return;
    }

    if (file.type === 'shortcut') {
      const target = file.shortcutTo ?? file.content;
      if (target?.startsWith('/')) {
        this.windowManagerService.addWindow({
          application: 'Explorer',
          icon: 'bi-folder',
          data: {
            title: file.name,
            content: target,
            type: 'directory',
          },
        });
      }
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
            folderId: resolved.folderId,
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
            folderId: resolved.folderId,
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
            content: file.content || 'No content available.',
            type: 'text',
            itemId: file._id,
            parentId: file.parentId ?? resolved.folderId,
          },
        });
    }
  }

  async cat(fileName: string) {
    if (!fileName) {
      this.output.push('cat: missing file name');
      return;
    }

    const resolved = await this.resolveFolderForPath(fileName);
    if (!resolved) {
      this.output.push(`cat: file "${fileName}" not found`);
      return;
    }

    const children = await this.listChildren(resolved.folderId);
    const file = children.find((c) => this.matchFile(resolved.fileName, c));

    if (!file) {
      this.output.push(`cat: file "${resolved.fileName}" not found`);
      return;
    }

    if (file.type === 'md') {
      this.output.push(file.content || 'No content available.');
      return;
    }

    this.output.push(`cat: "${resolved.fileName}" is not a text file`);
  }

  async touch(path: string) {
    if (!path) {
      this.output.push('touch: missing file name');
      return;
    }

    const resolved = await this.resolveFolderForPath(path);
    if (!resolved) {
      this.output.push(`touch: invalid path: ${path}`);
      return;
    }

    const name = this.normalizeNameForType(resolved.fileName, 'md').trim();
    if (!name) {
      this.output.push('touch: invalid file name');
      return;
    }

    await this.filesStore.create({
      name,
      type: 'md',
      parentId: resolved.folderId,
      content: '',
    });

    this.output.push(`created: ${name}.md`);
  }

  async mkdir(path: string) {
    if (!path) {
      this.output.push('mkdir: missing folder name');
      return;
    }

    const resolved = await this.resolveFolderForPath(path);
    if (!resolved) {
      this.output.push(`mkdir: invalid path: ${path}`);
      return;
    }

    const name = resolved.fileName.trim();
    if (!name) {
      this.output.push('mkdir: invalid folder name');
      return;
    }

    await this.filesStore.create({
      name,
      type: 'directory',
      parentId: resolved.folderId,
    });

    this.output.push(`created directory: ${name}`);
  }

  async rm(path: string) {
    if (!path) {
      this.output.push('rm: missing file/folder name');
      return;
    }

    const resolved = await this.resolveFolderForPath(path);
    if (!resolved) {
      this.output.push(`rm: not found: ${path}`);
      return;
    }

    const children = await this.listChildren(resolved.folderId);
    const node = children.find((c) => this.matchFile(resolved.fileName, c));
    if (!node || !node._id) {
      this.output.push(`rm: not found: ${resolved.fileName}`);
      return;
    }

    await this.filesStore.delete(node._id);
    this.output.push(`deleted: ${this.displayName(node)}`);
  }

  private async resolveDirectoryPath(path: string): Promise<string | null> {
    if (!path) return null;
    if (path === '/') return null;

    const isAbs = path.startsWith('/');
    const parts = path.split('/').filter(Boolean);
    let currentId: string | null = isAbs ? null : this.currentFolderId;
    const folderNames: string[] = isAbs ? [] : [...this.currentPath];

    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        if (folderNames.length === 0) return null;
        folderNames.pop();
        currentId = await this.resolveFolderIdByNames(folderNames);
        continue;
      }

      const children = await this.listChildren(currentId);
      const next = children.find(
        (c) => c.type === 'directory' && c.name === part && !!c._id,
      );
      if (!next || !next._id) return null;

      currentId = next._id;
      folderNames.push(next.name);
    }

    return currentId;
  }

  async mv(source: string, dest: string) {
    if (!source || !dest) {
      this.output.push('mv: usage: mv <source> <dest>');
      return;
    }

    const srcResolved = await this.resolveFolderForPath(source);
    if (!srcResolved) {
      this.output.push(`mv: not found: ${source}`);
      return;
    }

    const srcChildren = await this.listChildren(srcResolved.folderId);
    const node = srcChildren.find((c) =>
      this.matchFile(srcResolved.fileName, c),
    );
    if (!node || !node._id) {
      this.output.push(`mv: not found: ${srcResolved.fileName}`);
      return;
    }

    let destParentId: string | null;
    let destName: string;

    if (dest.endsWith('/')) {
      const dirId = await this.resolveDirectoryPath(dest);
      if (dirId === null && dest !== '/') {
        this.output.push(`mv: no such directory: ${dest}`);
        return;
      }
      destParentId = dirId;
      destName = node.name;
    } else {
      const destResolved = await this.resolveFolderForPath(dest);
      if (!destResolved) {
        this.output.push(`mv: invalid destination: ${dest}`);
        return;
      }
      destParentId = destResolved.folderId;
      destName = destResolved.fileName;
    }

    const normalizedName = this.normalizeNameForType(
      destName,
      node.type,
    ).trim();
    if (!normalizedName) {
      this.output.push('mv: invalid destination name');
      return;
    }

    const currentParentId = node.parentId ?? null;
    if (destParentId !== currentParentId) {
      await this.filesStore.move(node._id, destParentId);
    }
    if (normalizedName !== node.name) {
      await this.filesStore.update(node._id, { name: normalizedName });
    }

    this.output.push(
      `updated: ${this.displayName({ ...node, name: normalizedName })}`,
    );
  }

  upload() {
    this.pendingUploadParentId = this.currentFolderId;
    this.uploadInput?.nativeElement.click();
  }

  async onUploadSelected(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    if (!file) return;

    input!.value = '';

    const type = mimeToFileNodeType(file.type || '');

    if (!type) {
      this.output.push('upload: unsupported file type');
      return;
    }

    const name = stripExtension(file.name).trim();
    if (!name) {
      this.output.push('upload: invalid file name');
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      await this.filesStore.create({
        name,
        type,
        parentId: this.pendingUploadParentId ?? this.currentFolderId,
        url: dataUrl,
      });
      this.output.push(`uploaded: ${name}.${type}`);
    } catch (err) {
      this.handleAuthError(err);
      this.output.push('upload: failed');
    } finally {
      this.pendingUploadParentId = null;
    }
  }

  showHelp() {
    this.output.push('Available commands:');
    this.output.push('- ls: List directory contents');
    this.output.push('- cd <folder>: Change directory');
    this.output.push('- pwd: Show current path');
    this.output.push('- echo <text>: Print text');
    this.output.push('- open <file>: Open md, image, or media file');
    this.output.push('- cat <textFiles>: Preview text files');
    this.output.push('- touch <name>: Create a new text file (.md)');
    this.output.push('- mkdir <name>: Create a new folder');
    this.output.push('- mv <src> <dest>: Rename or move an item');
    this.output.push('- rm <name>: Delete a file or folder');
    this.output.push('- upload: Upload image/video/audio into current folder');
    this.output.push('- help: Show this help');
    this.output.push('- clear: Clear terminal output');
    this.output.push('- exit: Close terminal session');
  }

  handleKey(event: KeyboardEvent) {
    if (event.key === 'ArrowUp') {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.command = this.commandHistory[this.historyIndex];
        event.preventDefault();
      }
    } else if (event.key === 'ArrowDown') {
      if (this.historyIndex < this.commandHistory.length - 1) {
        this.historyIndex++;
        this.command = this.commandHistory[this.historyIndex];
      } else {
        this.historyIndex = this.commandHistory.length;
        this.command = '';
      }
      event.preventDefault();
    }
  }

  scrollToBottom() {
    setTimeout(() => {
      this.requestScrollToBottom.emit();
    }, 1);
  }

  private handleAuthError(err: unknown) {
    logoutOn401(this.authenticationService, err);
  }
}
