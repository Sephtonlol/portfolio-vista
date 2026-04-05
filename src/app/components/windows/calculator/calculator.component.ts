import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { WindowManagerService } from '../../../services/window-manager.service';

@Component({
  selector: 'app-calculator',
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.css'],
})
export class CalculatorComponent implements AfterViewInit, OnDestroy {
  @Input() id!: string | undefined;

  @ViewChild('keyboardInput') keyboardInput?: ElementRef<HTMLInputElement>;

  private focusSub?: Subscription;

  display = '';
  topDisplay = '';
  history: string[] = [];
  showHistory = false;

  private current = '';
  private previous = '';
  private operator = '';

  constructor(private windowManagerService: WindowManagerService) {
    this.focusSub = this.windowManagerService.focus$.subscribe((evt) => {
      if (!evt || !this.id) return;
      if (evt.id !== this.id) return;
      this.focusKeyboard();
    });
  }

  ngAfterViewInit(): void {
    this.focusKeyboard();
  }

  ngOnDestroy(): void {
    this.focusSub?.unsubscribe();
  }

  private focusKeyboard(): void {
    if (window.innerWidth < 922) return;
    setTimeout(() => {
      this.keyboardInput?.nativeElement?.focus();
    }, 0);
  }

  onKeydown(event: KeyboardEvent) {
    const key = event.key;

    if (key >= '0' && key <= '9') {
      this.press(key);
      event.preventDefault();
      return;
    }

    if (key === '.' || key === ',') {
      this.pressDot();
      event.preventDefault();
      return;
    }

    if (key === '+' || key === '-' || key === '*' || key === '/') {
      this.op(key);
      event.preventDefault();
      return;
    }

    if (key === 'Enter' || key === '=') {
      this.calc();
      event.preventDefault();
      return;
    }

    if (key === 'Backspace') {
      this.back();
      event.preventDefault();
      return;
    }

    if (key === 'Escape') {
      this.clear();
      event.preventDefault();
      return;
    }

    if (key === 'Delete') {
      this.clearEntry();
      event.preventDefault();
      return;
    }
  }

  press(num: string) {
    this.current += num;
    this.display = this.current;
  }

  op(op: string) {
    if (!this.current) return;

    if (this.previous && this.operator) {
      this.calc();
    }

    this.operator = op;
    this.previous = this.current;
    this.current = '';

    this.topDisplay = `${this.previous} ${this.operator}`;
  }

  clear() {
    this.current = '';
    this.previous = '';
    this.operator = '';
    this.display = '';
    this.topDisplay = '';
  }

  clearEntry() {
    this.current = '';
    this.display = '';
  }

  back() {
    this.current = this.current.slice(0, -1);
    this.display = this.current;
  }

  toggleSign() {
    if (!this.current) return;
    this.current = (-parseFloat(this.current)).toString();
    this.display = this.current;
  }

  pressDot() {
    if (!this.current.includes('.')) {
      this.current += this.current ? '.' : '0.';
      this.display = this.current;
    }
  }

  clearHistory() {
    this.history = [];
  }
  toggleHistory() {
    this.showHistory = !this.showHistory;
  }

  calc() {
    if (!this.operator || !this.previous || !this.current) return;

    const a = parseFloat(this.previous);
    const b = parseFloat(this.current);
    let result = 0;

    switch (this.operator) {
      case '+':
        result = a + b;
        break;
      case '-':
        result = a - b;
        break;
      case '*':
        result = a * b;
        break;
      case '/':
        result = b !== 0 ? a / b : NaN;
        break;
    }

    this.history.unshift(
      `${this.previous} ${this.operator} ${this.current} = ${result}`
    );
    this.display = result.toString();
    this.topDisplay = '';
    this.current = result.toString();
    this.previous = '';
    this.operator = '';
  }
}
