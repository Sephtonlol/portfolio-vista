import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserService } from '../../../services/api/browser.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import {
  BrowserView,
  ImageResult,
  Result,
  Tab,
} from '../../../interfaces/browser.interface';

@Component({
  selector: 'app-browser',
  imports: [FormsModule],
  templateUrl: './browser.component.html',
  styleUrl: './browser.component.css',
})
export class BrowserComponent {
  tabs: Tab[] = [];
  activeTabId: number = 0;
  private nextId = 1;

  constructor(
    private browserService: BrowserService,
    private sanitizer: DomSanitizer,
  ) {
    this.addTab(); // start with 1 tab
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
      isLoadingSites: false,
      isLoadingImages: false,
    };

    this.tabs.push(newTab);
    this.activeTabId = newTab.id;
  }

  closeTab(id: number) {
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
      tab.results = (res.results ?? []) as Result[];
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
      tab.imageResults = (res.results ?? []) as ImageResult[];
    } finally {
      tab.isLoadingImages = false;
    }
  }

  sanitize(url: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }
}
