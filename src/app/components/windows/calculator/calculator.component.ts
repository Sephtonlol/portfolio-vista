import { Component } from '@angular/core';

@Component({
  selector: 'app-calculator',
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.css'],
})
export class CalculatorComponent {
  display = '';
  topDisplay = '';
  history: string[] = [];

  private current = '';
  private previous = '';
  private operator = '';

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
