import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserService } from '../../../services/api/browser.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Result, Tab } from '../../../interfaces/browser.interface';

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
      results: [],
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

  async onSearch() {
    const tab = this.activeTab;

    try {
      const res = await this.browserService.search(tab.query);
      tab.results = res.results as Result[];
    } catch (err) {
      console.error(err);
    }
  }

  sanitize(url: string): SafeUrl {
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }
}
