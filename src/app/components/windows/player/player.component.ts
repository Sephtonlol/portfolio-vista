import { Component, Input, ViewChild, ElementRef } from '@angular/core';
import { Data } from '../../../interfaces/window.interface';
import portfolio from '../../../../data/data.json';

@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrl: './player.component.css',
})
export class PlayerComponent {
  @Input() data!: Data | undefined;
  @ViewChild('media') mediaRef!: ElementRef<HTMLMediaElement>;

  folderPath = '';
  videos: { name: string; url: string }[] = [];
  currentIndex = 0;
  isPlaying = false;

  ngOnInit() {
    if (!this.data?.content) return;

    const fullPath = this.data.content;

    if (fullPath.startsWith('http')) {
      this.videos = [{ name: 'video', url: fullPath }];
      return;
    }

    const lastSlash = fullPath.lastIndexOf('/');
    this.folderPath = fullPath.slice(0, lastSlash);
    const targetName = fullPath.slice(lastSlash + 1);

    const folderNode = this.getNodeByPath(this.folderPath);
    if (!folderNode) {
      console.error(`PlayerComponent: No folder at path "${this.folderPath}"`);
      return;
    }

    this.videos = folderNode.children
      .filter((child: any) => child.type === 'mp4' || child.type === 'mp3')
      .map((child: any) => ({ name: child.name, url: child.content }));

    this.currentIndex = this.videos.findIndex((vid) => vid.name === targetName);
    this.autoplay();
  }

  get currentVideo() {
    return this.videos[this.currentIndex];
  }

  next() {
    if (this.currentIndex < this.videos.length - 1) this.currentIndex++;
    else this.currentIndex = 0;
    this.autoplay();
  }

  prev() {
    if (this.currentIndex > 0) this.currentIndex--;
    else this.currentIndex = this.videos.length - 1;
    this.autoplay();
  }

  autoplay() {
    setTimeout(() => {
      const video = this.mediaRef?.nativeElement;
      if (video) {
        video.load();
        video.play();
        this.isPlaying = true;
      }
    }, 100);
  }

  getNodeByPath(path: string): any {
    const parts = path.split('/').filter(Boolean);
    let node: any = portfolio;

    for (const part of parts) {
      const next = node.children?.find(
        (child: any) => child.name === part && child.type === 'directory'
      );
      if (!next) {
        return null;
      }
      node = next;
    }

    return node;
  }
}
