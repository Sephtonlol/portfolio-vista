import { Component, HostListener, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserService } from '../../../services/api/browser.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import {
  BrowserView,
  ImageResult,
  Result,
  Tab,
} from '../../../interfaces/browser.interface';
import { WindowManagerService } from '../../../services/window-manager.service';

type ImagePreviewStage = 'start' | 'end';

type ImagePreviewRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: number;
};

type ContainerRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

@Component({
  selector: 'app-browser',
  imports: [FormsModule],
  templateUrl: './browser.component.html',
  styleUrl: './browser.component.css',
})
export class BrowserComponent {
  @Input() id!: string | undefined;
  tabs: Tab[] = [];
  activeTabId: number = 0;
  private nextId = 1;

  private readonly imagePreviewTransitionMs = 220;

  imagePreview: {
    isOpen: boolean;
    stage: ImagePreviewStage;
    src: string;
    alt: string;
    startRect: ImagePreviewRect | null;
    endRect: ImagePreviewRect | null;
  } = {
    isOpen: false,
    stage: 'start',
    src: '',
    alt: '',
    startRect: null,
    endRect: null,
  };

  constructor(
    private browserService: BrowserService,
    private sanitizer: DomSanitizer,
    private windowManagerService: WindowManagerService,
  ) {
    this.addTab(); // start with 1 tab
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    this.closeImagePreview();
  }

  get activeTab(): Tab {
    return this.tabs.find((t) => t.id === this.activeTabId)!;
  }

  addTab() {
    const newTab: Tab = {
      id: this.nextId++,
      query: '',
      view: 'sites',
      results: [],
      imageResults: [],
      lastSitesQuery: '',
      lastImagesQuery: '',
      lastSitesDurationMs: null,
      lastImagesDurationMs: null,
      lastSitesResultCount: null,
      lastImagesResultCount: null,
      isLoadingSites: false,
      isLoadingImages: false,
    };

    this.tabs.push(newTab);
    this.activeTabId = newTab.id;
  }

  closeTab(id: number) {
    if (this.tabs.length == 1) {
      this.windowManagerService.closeWindow(this.id || '');
    }
    this.tabs = this.tabs.filter((t) => t.id !== id);

    if (this.activeTabId === id && this.tabs.length > 0) {
      this.activeTabId = this.tabs[0].id;
    }
  }

  switchTab(id: number) {
    this.activeTabId = id;
  }

  setView(view: BrowserView) {
    const tab = this.activeTab;
    tab.view = view;

    void this.loadIfNeeded(tab);
  }

  async onSearch() {
    const tab = this.activeTab;
    const query = tab.query.trim();

    if (!query) {
      tab.results = [];
      tab.imageResults = [];
      tab.lastSitesQuery = '';
      tab.lastImagesQuery = '';
      tab.lastSitesDurationMs = null;
      tab.lastImagesDurationMs = null;
      tab.lastSitesResultCount = null;
      tab.lastImagesResultCount = null;
      return;
    }

    try {
      if (tab.view === 'images') {
        await this.fetchImages(tab, query);
      } else {
        await this.fetchSites(tab, query);
      }
    } catch (err) {
      console.error(err);
    }
  }

  private async fetchSites(tab: Tab, query: string) {
    if (tab.isLoadingSites) return;

    tab.isLoadingSites = true;
    tab.lastSitesQuery = query;

    try {
      const res = await this.browserService.search(query);
      tab.results = res.results ?? [];
      tab.lastSitesDurationMs = res.durationMs;
      tab.lastSitesResultCount = res.resultCount;
    } finally {
      tab.isLoadingSites = false;
    }
  }

  private async loadIfNeeded(tab: Tab) {
    const query = tab.query.trim();
    if (!query) return;

    if (tab.view === 'images') {
      if (tab.isLoadingImages) return;
      if (tab.lastImagesQuery === query) return;

      await this.fetchImages(tab, query);
      return;
    }

    if (tab.isLoadingSites) return;
    if (tab.lastSitesQuery === query) return;

    await this.fetchSites(tab, query);
  }

  private async fetchImages(tab: Tab, query: string) {
    if (tab.isLoadingImages) return;

    tab.isLoadingImages = true;
    tab.lastImagesQuery = query;

    try {
      const res = await this.browserService.images(query);
      tab.imageResults = res.results ?? [];
      tab.lastImagesDurationMs = res.durationMs;
      tab.lastImagesResultCount = res.resultCount;
    } finally {
      tab.isLoadingImages = false;
    }
  }

  sanitize(url: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  get imagePreviewRect(): ImagePreviewRect | null {
    if (!this.imagePreview.isOpen) return null;

    return this.imagePreview.stage === 'end'
      ? this.imagePreview.endRect
      : this.imagePreview.startRect;
  }

  openImagePreview(image: ImageResult, event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const imgEl = (target.closest('img') as HTMLImageElement | null) ?? null;
    if (!imgEl) return;

    const rect = imgEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const containerRect = this.getPreviewContainerRect(imgEl);

    const startRect: ImagePreviewRect = {
      top: rect.top - containerRect.top,
      left: rect.left - containerRect.left,
      width: rect.width,
      height: rect.height,
      borderRadius: 5,
    };

    const endRect = this.computeCenteredPreviewRect(
      containerRect.width,
      containerRect.height,
    );

    this.imagePreview = {
      isOpen: true,
      stage: 'start',
      src: image.image || image.thumbnail,
      alt: image.title ?? 'Image preview',
      startRect,
      endRect,
    };

    requestAnimationFrame(() => {
      if (!this.imagePreview.isOpen) return;
      this.imagePreview.stage = 'end';
    });
  }

  closeImagePreview() {
    if (!this.imagePreview.isOpen) return;
    if (!this.imagePreview.startRect) {
      this.imagePreview.isOpen = false;
      return;
    }

    this.imagePreview.stage = 'start';

    window.setTimeout(() => {
      this.imagePreview.isOpen = false;
      this.imagePreview.src = '';
      this.imagePreview.alt = '';
      this.imagePreview.startRect = null;
      this.imagePreview.endRect = null;
    }, this.imagePreviewTransitionMs);
  }

  private computeCenteredPreviewRect(): ImagePreviewRect;
  private computeCenteredPreviewRect(
    containerWidth: number,
    containerHeight: number,
  ): ImagePreviewRect;
  private computeCenteredPreviewRect(
    containerWidth: number = window.innerWidth,
    containerHeight: number = window.innerHeight,
  ): ImagePreviewRect {
    const margin = 24;
    const maxWidth = Math.max(0, containerWidth - margin * 2);
    const maxHeight = Math.max(0, containerHeight - margin * 2);

    const width = Math.min(maxWidth, 900);
    const height = Math.min(maxHeight, 700);

    return {
      top: Math.round((containerHeight - height) / 2),
      left: Math.round((containerWidth - width) / 2),
      width: Math.round(width),
      height: Math.round(height),
      borderRadius: 8,
    };
  }

  private getPreviewContainerRect(imgEl: HTMLImageElement): ContainerRect {
    const containerEl = imgEl.closest('.window') as HTMLElement | null;
    if (!containerEl) {
      return {
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
    }

    const rect = containerEl.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
  }
}
