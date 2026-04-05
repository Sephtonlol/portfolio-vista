import { Component, ElementRef, HostListener, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserService } from '../../../services/api/browser/browser.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import {
  BrowserView,
  ImageResult,
  Tab,
} from '../../../interfaces/browser.interface';
import { WindowManagerService } from '../../../services/window-manager.service';
import { FilesStoreService } from '../../../services/files-store.service';
import { ContextMenuService } from '../../../services/context-menu.service';

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

  private previewResizeObserver: ResizeObserver | null = null;
  private previewContentEl: HTMLElement | null = null;

  private readonly imagePreviewTransitionMs = 200;

  imagePreview: {
    isOpen: boolean;
    stage: ImagePreviewStage;
    src: string;
    alt: string;
    containerRect: ContainerRect | null;
    startRect: ImagePreviewRect | null;
    endRect: ImagePreviewRect | null;
  } = {
    isOpen: false,
    stage: 'start',
    src: '',
    alt: '',
    containerRect: null,
    startRect: null,
    endRect: null,
  };

  // Right-click download flow
  private contextImage: ImageResult | null = null;
  private previewImage: ImageResult | null = null;

  showDownloadDialog = false;
  downloadFolderNames: string[] = [];
  private downloadFolderIdStack: (string | null)[] = [null];
  downloadFolders: { id: string; name: string }[] = [];
  downloadFileName = '';
  private downloadSrc: string = '';

  constructor(
    private browserService: BrowserService,
    private sanitizer: DomSanitizer,
    private windowManagerService: WindowManagerService,
    private elementRef: ElementRef<HTMLElement>,
    private filesStore: FilesStoreService,
    private contextMenu: ContextMenuService,
  ) {
    this.addTab(); // start with 1 tab
  }

  ngOnDestroy(): void {
    this.disconnectPreviewObserver();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    this.closeImagePreview();
    this.closeDownloadDialog();
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.refreshImagePreviewLayout();
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

    const { windowTop, windowLeft, containerRect, contentEl } =
      this.getPreviewContainerRect(imgEl);

    if (containerRect.width === 0 || containerRect.height === 0) return;

    const startRect: ImagePreviewRect = {
      top: rect.top - windowTop - containerRect.top,
      left: rect.left - windowLeft - containerRect.left,
      width: rect.width,
      height: rect.height,
      borderRadius: 5,
    };

    const endRect = this.computeCenteredPreviewRect(
      containerRect.width,
      containerRect.height,
    );

    this.previewImage = image;

    this.imagePreview = {
      isOpen: true,
      stage: 'start',
      src: image.image || image.thumbnail,
      alt: image.title ?? 'Image preview',
      containerRect,
      startRect,
      endRect,
    };

    this.ensurePreviewObserver(contentEl);

    requestAnimationFrame(() => {
      if (!this.imagePreview.isOpen) return;
      this.imagePreview.stage = 'end';
    });
  }

  onImageContextMenu(image: ImageResult, event: MouseEvent) {
    event.preventDefault();
    this.contextImage = image;
    this.contextMenu.openAt(event.clientX + 2, event.clientY + 2, [
      {
        label: 'Download image',
        action: () => void this.openDownloadDialog(image),
      },
    ]);
  }

  private get downloadFolderId(): string | null {
    return (
      this.downloadFolderIdStack[this.downloadFolderIdStack.length - 1] ?? null
    );
  }

  async openDownloadDialog(imageOverride?: ImageResult | null) {
    const image = imageOverride ?? this.contextImage;
    if (!image) return;

    this.downloadSrc = image.image || image.thumbnail;
    this.downloadFileName = this.suggestImageName(image);

    this.showDownloadDialog = true;
    this.downloadFolderNames = [];
    this.downloadFolderIdStack = [null];

    await this.loadDownloadFolders();
  }

  closeDownloadDialog() {
    this.showDownloadDialog = false;
  }

  async downloadPreviewImage(event?: MouseEvent) {
    event?.stopPropagation();
    this.contextMenu.close();

    const img = this.previewImage;
    if (!img) return;
    await this.openDownloadDialog(img);
  }

  async loadDownloadFolders() {
    try {
      const children = await this.filesStore.list(this.downloadFolderId);
      this.downloadFolders = children
        .filter((c) => c.type === 'directory' && !!c._id)
        .map((c) => ({ id: c._id!, name: c.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      this.downloadFolders = [];
    }
  }

  async enterDownloadFolder(folder: { id: string; name: string }) {
    this.downloadFolderIdStack.push(folder.id);
    this.downloadFolderNames.push(folder.name);
    await this.loadDownloadFolders();
  }

  async upDownloadFolder() {
    if (this.downloadFolderIdStack.length <= 1) return;
    this.downloadFolderIdStack.pop();
    this.downloadFolderNames.pop();
    await this.loadDownloadFolders();
  }

  async confirmDownloadToFolder() {
    const name = this.downloadFileName.trim();
    if (!name) return;

    const parentId = this.downloadFolderId;
    const src = this.downloadSrc;
    if (!src) return;

    try {
      const dataUrl = await this.tryFetchAsDataUrl(src);

      await this.filesStore.create({
        name,
        type: 'png',
        parentId,
        url: dataUrl ?? src,
      });

      this.showDownloadDialog = false;
    } catch (err) {
      console.error(err);
    }
  }

  private suggestImageName(image: ImageResult): string {
    const raw = (image.title || 'image').trim();
    const cleaned = raw
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 60)
      .trim();
    return cleaned || 'image';
  }

  private async tryFetchAsDataUrl(url: string): Promise<string | null> {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read image blob'));
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.readAsDataURL(blob);
      });
    } catch {
      // CORS failures will land here.
      return null;
    }
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
      this.imagePreview.containerRect = null;
      this.imagePreview.startRect = null;
      this.imagePreview.endRect = null;

      this.previewImage = null;

      this.disconnectPreviewObserver();
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

  private getPreviewContainerRect(imgEl: HTMLImageElement): {
    windowTop: number;
    windowLeft: number;
    containerRect: ContainerRect;
    contentEl: HTMLElement | null;
  } {
    const windowEl = imgEl.closest('.window') as HTMLElement | null;
    const contentEl =
      (imgEl.closest('.window-content') as HTMLElement | null) ??
      (windowEl?.querySelector('.window-content') as HTMLElement | null) ??
      null;

    if (!windowEl || !contentEl) {
      return {
        windowTop: 0,
        windowLeft: 0,
        containerRect: {
          top: 0,
          left: 0,
          width: window.innerWidth,
          height: window.innerHeight,
        },
        contentEl,
      };
    }

    const windowRect = windowEl.getBoundingClientRect();
    const contentRect = contentEl.getBoundingClientRect();

    return {
      windowTop: windowRect.top,
      windowLeft: windowRect.left,
      containerRect: {
        top: contentRect.top - windowRect.top,
        left: contentRect.left - windowRect.left,
        width: contentRect.width,
        height: contentRect.height,
      },
      contentEl,
    };
  }

  private ensurePreviewObserver(contentEl: HTMLElement | null) {
    if (!contentEl) return;
    if (this.previewContentEl === contentEl && this.previewResizeObserver)
      return;

    this.disconnectPreviewObserver();
    this.previewContentEl = contentEl;

    this.previewResizeObserver = new ResizeObserver(() => {
      this.refreshImagePreviewLayout();
    });
    this.previewResizeObserver.observe(contentEl);
  }

  private disconnectPreviewObserver() {
    this.previewResizeObserver?.disconnect();
    this.previewResizeObserver = null;
    this.previewContentEl = null;
  }

  private refreshImagePreviewLayout() {
    if (!this.imagePreview.isOpen) return;

    const hostEl = this.elementRef.nativeElement;
    const windowEl = hostEl.closest('.window') as HTMLElement | null;
    const contentEl =
      (hostEl.closest('.window-content') as HTMLElement | null) ??
      (windowEl?.querySelector('.window-content') as HTMLElement | null) ??
      null;

    if (!windowEl || !contentEl) return;

    const windowRect = windowEl.getBoundingClientRect();
    const contentRect = contentEl.getBoundingClientRect();

    const containerRect: ContainerRect = {
      top: contentRect.top - windowRect.top,
      left: contentRect.left - windowRect.left,
      width: contentRect.width,
      height: contentRect.height,
    };

    this.imagePreview.containerRect = containerRect;
    this.imagePreview.endRect = this.computeCenteredPreviewRect(
      containerRect.width,
      containerRect.height,
    );

    this.ensurePreviewObserver(contentEl);
  }
}
