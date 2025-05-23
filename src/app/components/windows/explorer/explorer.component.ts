import { Component, Input, OnInit } from '@angular/core';
import portfolio from '../../../../data/data.json';
import { FileNode } from '../../../interfaces/file.interface';
import { FormsModule } from '@angular/forms';
import { WindowManagerService } from '../../../services/window-manager.service';
import { Data } from '@angular/router';

@Component({
  selector: 'app-explorer',
  imports: [FormsModule],
  templateUrl: './explorer.component.html',
  styleUrl: './explorer.component.css',
})
export class ExplorerComponent implements OnInit {
  @Input() data!: Data | undefined;

  filesystem: FileNode = portfolio as FileNode;
  currentPath: string[] = [];
  searchTerm: string = '';
  pathInput: string = '';
  windowWidth = window.innerWidth;

  viewList = true;

  pathHistory: string[] = ['/'];
  historyIndex: number = 0;

  constructor(private windowManagerService: WindowManagerService) { }

  ngOnInit(): void {
    this.pathInput =
      '/' + (this.data ? this.data['content'] : this.currentPath.join('/'));
    this.goToTypedPath();
  }

  goUp() {
    if (this.currentPath.length > 0) {
      this.currentPath.pop();
      this.pathInput = '/' + this.currentPath.join('/');
      this.updatePathHistory(this.pathInput);
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
      this.navigateToPath(this.pathHistory[this.historyIndex]);
    }
  }

  goForward(): void {
    if (this.historyIndex < this.pathHistory.length - 1) {
      this.historyIndex++;
      this.navigateToPath(this.pathHistory[this.historyIndex]);
    }
  }

  navigateToPath(path: string): void {
    const parts = path.split('/').filter(Boolean);
    let dir = this.filesystem;
    for (const part of parts) {
      const next = dir.children?.find(
        (child) => child.name === part && child.type === 'directory'
      );
      if (!next) return;
      dir = next;
    }
    this.currentPath = parts;
    this.pathInput = '/' + this.currentPath.join('/');
    this.searchTerm = '';
  }

  get currentDir(): FileNode {
    let dir = this.filesystem;
    for (const part of this.currentPath) {
      const next = dir.children?.find(
        (child) => child.name === part && child.type === 'directory'
      );
      if (next) dir = next;
    }
    return dir;
  }

  get filteredChildren(): FileNode[] {
    const children = this.currentDir.children || [];
    return children
      .filter((child) =>
        child.name.toLowerCase().includes(this.searchTerm.toLowerCase())
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

  openItem(file: FileNode) {
    if (file.type === 'directory') {
      this.currentPath.push(file.name);
      const newPath = '/' + this.currentPath.join('/');
      this.pathInput = newPath;
      this.searchTerm = '';
      this.updatePathHistory(newPath);
      return;
    }
    if (file.type === 'shortcut') {
      if (!file.content)
        return console.error('Failed to open shortcut location');
      this.currentPath = file.content.split('/').filter(Boolean);
      const newPath = file.content;
      this.pathInput = newPath;
      this.updatePathHistory(newPath);
      return;
    }

    switch (file.type) {
      case 'png':
        this.windowManagerService.addWindow({
          application: 'Photos',
          icon: 'bi-image',
          data: {
            title: file.name,
            content: this.pathInput + '/' + file.name || '',
            type: 'image',
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
            content: this.pathInput + '/' + file.name || '',
            type: 'media',
          },
        });
        break;
      case 'url':
        window.open(file.content, '_blank');
        break;
      default:
        this.windowManagerService.addWindow({
          application: 'Notepad',
          icon: 'bi-file-earmark-text',
          data: {
            title: file.name,
            content: file.content || '',
            type: 'text',
          },
        });
    }
  }

  goToTypedPath() {
    if (this.pathInput === 'cmd') {
      this.windowManagerService.addWindow({
        application: 'Terminal',
        icon: 'bi-terminal',
        data: {
          title: 'Terminal',
          type: 'directory',
          content: [...this.currentPath].join('/'),
        },
      });
    }
    const parts = this.pathInput.split('/').filter(Boolean);
    let dir = this.filesystem;
    for (const part of parts) {
      const next = dir.children?.find(
        (child) => child.name === part && child.type === 'directory'
      );
      if (!next) return;
      dir = next;
    }
    this.currentPath = parts;
    this.searchTerm = '';
    this.updatePathHistory(this.pathInput);
  }
}
