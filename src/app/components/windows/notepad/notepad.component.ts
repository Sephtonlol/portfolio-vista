import { Component, Input, OnInit } from '@angular/core';
import { Data } from '../../../interfaces/window.interface';

@Component({
  selector: 'app-notepad',
  imports: [],
  templateUrl: './notepad.component.html',
  styleUrl: './notepad.component.css',
})
export class NotepadComponent {
  @Input() data!: Data | undefined;
}
