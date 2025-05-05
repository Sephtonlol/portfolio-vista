import { Component, Input, OnInit, SimpleChanges } from '@angular/core';
import { Data } from '../../../interfaces/window.interface';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-notepad',
  imports: [FormsModule],
  templateUrl: './notepad.component.html',
  styleUrl: './notepad.component.css',
})
export class NotepadComponent {
  @Input() data!: Data | undefined;

  contentValue: string = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data?.content) {
      this.contentValue = this.data.content;
    }
  }
}
