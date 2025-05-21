import { Component, Input } from '@angular/core';
import { Data } from '../../../interfaces/window.interface';
import portfolio from '../../../../data/data.json';

@Component({
  selector: 'app-photos',
  imports: [],
  templateUrl: './photos.component.html',
  styleUrl: './photos.component.css',
})
export class PhotosComponent {
  @Input() data!: Data | undefined;

  folderPath = '';
  images: { name: string; url: string }[] = [];
  currentIndex = 0;

  ngOnInit() {
    if (!this.data?.content) return;

    const fullPath = this.data.content;

    if (fullPath.startsWith('http')) {
      this.images = [{ name: 'image', url: fullPath }];
      return;
    }

    const lastSlash = fullPath.lastIndexOf('/');
    this.folderPath = fullPath.slice(0, lastSlash);
    const targetName = fullPath.slice(lastSlash + 1);

    const folderNode = this.getNodeByPath(this.folderPath);
    if (!folderNode) {
      console.error(`PhotosComponent: No folder at path “${this.folderPath}”`);
      return;
    }

    this.images = folderNode.children
      .filter((child: any) => child.type === 'png')
      .map((child: any) => ({ name: child.name, url: child.content }));

    this.currentIndex = this.images.findIndex((img) => img.name === targetName);
  }

  get currentImage() {
    return this.images[this.currentIndex];
  }

  next() {
    if (this.currentIndex < this.images.length - 1) this.currentIndex++;
    else this.currentIndex = 0;
  }

  prev() {
    if (this.currentIndex > 0) this.currentIndex--;
    else this.currentIndex = this.images.length - 1;
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
