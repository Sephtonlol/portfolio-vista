import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

@Component({
  selector: 'app-error-dialog',
  standalone: true,
  templateUrl: './error-dialog.component.html',
  styleUrl: './error-dialog.component.css',
})
export class ErrorDialogComponent implements OnChanges {
  @Input() open = false;

  @Input() title = 'Error';
  @Input() message = '';
  @Input() iconClass = 'bi-exclamation-triangle-fill';

  @Input() primaryLabel = 'OK';
  @Input() secondaryLabel: string | null = null;

  @Output() primary = new EventEmitter<void>();
  @Output() secondary = new EventEmitter<void>();
  @Output() dismiss = new EventEmitter<void>();

  @ViewChild('dialog') dialog?: ElementRef<HTMLElement>;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['open']) return;
    if (!this.open) return;

    // Defer to allow DOM to render.
    setTimeout(() => {
      this.dialog?.nativeElement.focus({ preventScroll: true });
    }, 0);
  }

  onPrimaryClick(): void {
    this.primary.emit();
  }

  onSecondaryClick(): void {
    this.secondary.emit();
  }

  onBackdropClick(): void {
    this.dismiss.emit();
  }
}
