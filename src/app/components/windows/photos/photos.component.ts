import { Component, Input, OnInit } from '@angular/core';
import { Data } from '../../../interfaces/window.interface';
import { FilesService } from '../../../services/api/files/files.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-photos',
  imports: [],
  templateUrl: './photos.component.html',
  styleUrl: './photos.component.css',
})
export class PhotosComponent implements OnInit {
  @Input() data!: Data | undefined;

  folderPath = '';
  images: { id?: string; name: string; url: string }[] = [];
  currentIndex = 0;

  constructor(private filesService: FilesService) {}

  async ngOnInit() {
    if (!this.data?.content) return;

    const url = this.data.url ?? this.data.content;
    if (url.startsWith('http')) {
      this.images = [{ name: this.data.title || 'image', url }];
      return;
    }

    const folderId = this.data.folderId ?? null;
    if (!folderId) {
      // Fallback: treat provided content as a direct URL/path.
      this.images = [{ name: this.data.title || 'image', url }];
      return;
    }

    const children = await firstValueFrom(
      this.filesService.listByParent(folderId),
    );
    this.images = children
      .filter((c) => c.type === 'png')
      .map((c) => ({ id: c._id, name: c.name, url: c.url ?? c.content ?? '' }))
      .filter((c) => !!c.url);

    const selectedId = this.data.selectedId;
    if (selectedId) {
      const idx = this.images.findIndex((img) => img.id === selectedId);
      this.currentIndex = idx >= 0 ? idx : 0;
    } else {
      this.currentIndex = 0;
    }
  }

  get currentImage() {
    return this.images[this.currentIndex] ?? { name: '', url: '' };
  }

  next() {
    if (this.currentIndex < this.images.length - 1) this.currentIndex++;
    else this.currentIndex = 0;
  }

  prev() {
    if (this.currentIndex > 0) this.currentIndex--;
    else this.currentIndex = this.images.length - 1;
  }
}
