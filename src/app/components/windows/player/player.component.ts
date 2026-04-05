import { Component, Input, ViewChild, ElementRef, OnInit } from '@angular/core';
import { Data } from '../../../interfaces/window.interface';
import { FilesService } from '../../../services/api/files/files.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-player',
  templateUrl: './player.component.html',
  styleUrl: './player.component.css',
})
export class PlayerComponent {
  @Input() data!: Data | undefined;
  @ViewChild('media') mediaRef!: ElementRef<HTMLMediaElement>;

  folderPath = '';
  videos: { id?: string; name: string; url: string; type?: 'mp4' | 'mp3' }[] =
    [];
  currentIndex = 0;
  isPlaying = false;

  constructor(private filesService: FilesService) {}

  async ngOnInit() {
    if (!this.data?.content) return;

    const url = this.data.url ?? this.data.content;
    if (url.startsWith('http')) {
      this.videos = [{ name: this.data.title || 'media', url }];
      return;
    }

    const folderId = this.data.folderId ?? null;
    if (!folderId) {
      this.videos = [{ name: this.data.title || 'media', url }];
      return;
    }

    const children = await firstValueFrom(
      this.filesService.listByParent(folderId),
    );
    this.videos = children
      .filter(
        (c): c is typeof c & { type: 'mp4' | 'mp3' } =>
          c.type === 'mp4' || c.type === 'mp3',
      )
      .map((c) => ({
        id: c._id,
        name: c.name,
        url: c.url ?? c.content ?? '',
        type: c.type,
      }))
      .filter((c) => !!c.url);

    const selectedId = this.data.selectedId;
    if (selectedId) {
      const idx = this.videos.findIndex((vid) => vid.id === selectedId);
      this.currentIndex = idx >= 0 ? idx : 0;
    } else {
      this.currentIndex = 0;
    }

    this.autoplay();
  }

  get currentVideo() {
    return this.videos[this.currentIndex] ?? { name: '', url: '' };
  }

  isVideo(item: { url: string; type?: string }): boolean {
    if (item.type === 'mp4') return true;
    if (item.type === 'mp3') return false;

    const mime = this.getDataUrlMime(item.url);
    if (mime?.startsWith('video/')) return true;
    if (mime?.startsWith('audio/')) return false;

    return this.urlLooksLikeMp4(item.url);
  }

  private getDataUrlMime(url: string): string | null {
    if (!url.startsWith('data:')) return null;
    const commaIdx = url.indexOf(',');
    const header = (commaIdx >= 0 ? url.slice(5, commaIdx) : url.slice(5))
      .trim()
      .toLowerCase();
    if (!header) return null;

    // Example: data:video/mp4;base64,.... OR data:audio/mpeg;....
    const semiIdx = header.indexOf(';');
    const mime = (semiIdx >= 0 ? header.slice(0, semiIdx) : header).trim();
    return mime || null;
  }

  private urlLooksLikeMp4(url: string): boolean {
    return /\.mp4($|[?#])/i.test(url);
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
}
