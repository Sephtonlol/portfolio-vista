import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { Data } from '../../../interfaces/window.interface';
import { FormsModule } from '@angular/forms';
import MarkdownIt from 'markdown-it';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import hljs from 'highlight.js';
import csharp from 'highlight.js/lib/languages/csharp';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import css from 'highlight.js/lib/languages/css';
import html from 'highlight.js/lib/languages/xml';

@Component({
  selector: 'app-notepad',
  imports: [FormsModule],
  templateUrl: './notepad.component.html',
  styleUrls: ['./notepad.component.css'],
  standalone: true,
})
export class NotepadComponent implements OnChanges, OnInit {
  @Input() data!: Data | undefined;

  preview = false;
  contentValue: string = '';
  sanitizedHtml: SafeHtml = '';

  md: MarkdownIt;

  constructor(private sanitizer: DomSanitizer) {
    hljs.registerLanguage('csharp', csharp);
    hljs.registerLanguage('typescript', typescript);
    hljs.registerLanguage('javascript', javascript);
    hljs.registerLanguage('python', python);
    hljs.registerLanguage('java', java);
    hljs.registerLanguage('css', css);
    hljs.registerLanguage('html', html);

    this.md = new MarkdownIt({
      breaks: true,
      highlight: (code: any, lang) => {
        if (lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        } else {
          return hljs.highlightAuto(code).value;
        }
      }
    });
  }
  ngOnInit(): void {
    this.preview = !!this.contentValue
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data?.content) {
      this.contentValue = this.data.content;
      this.updateMarkdown();
    }
  }

  updateMarkdown() {
    const rawHtml = this.md.render(this.contentValue || '');
    this.sanitizedHtml = this.sanitizer.bypassSecurityTrustHtml(rawHtml);
  }

  onContentChange() {
    this.updateMarkdown();
  }
}
