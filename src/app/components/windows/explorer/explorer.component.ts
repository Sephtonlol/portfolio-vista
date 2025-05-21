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

  viewList = true;

  constructor(private windowManagerService: WindowManagerService) { }

  ngOnInit(): void {
    this.pathInput =
      '/' + (this.data ? this.data['content'] : this.currentPath.join('/'));
    this.goToTypedPath();
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
    if (type === 'directory' || type === 'shortcut') return 'bi-folder';
    if (type === 'md') return 'bi-file-earmark-text';
    if (type === 'png') return 'bi-image';
    if (type === 'mp3') return 'bi-music-note';
    if (type === 'mp4') return 'bi-film';
    return 'bi-file-earmark';
  }

  openItem(item: FileNode) {
    if (item.type === 'directory') {
      this.currentPath.push(item.name);
      this.pathInput = '/' + this.currentPath.join('/');
      this.searchTerm = '';
      return;
    }
    if (item.type === 'shortcut') {
      if (!item.content)
        return console.error('Failed to open shortcut location');
      this.currentPath = item.content.split('/').filter(Boolean);
      this.pathInput = item.content;
      return;
    }

    switch (item.type) {
      case 'png':
        this.windowManagerService.addWindow({
          application: 'Photos',
          icon: 'bi-image',
          data: {
            title: item.name,
            content: this.pathInput + '/' + item.name || '',
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
            title: item.name,
            content: this.pathInput + '/' + item.name || '',
            type: 'media',
          },
        });
        break;
      default:
        this.windowManagerService.addWindow({
          application: 'Notepad',
          icon: 'bi-file-earmark-text',
          data: {
            title: item.name,
            content: item.content || '',
            type: 'text',
          },
        });
    }
  }

  goUp() {
    if (this.currentPath.length > 0) {
      this.currentPath.pop();
      this.pathInput = '/' + this.currentPath.join('/');
    }
  }

  resetPathInput() {
    this.pathInput = '/' + this.currentPath.join('/');
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
  }
}
