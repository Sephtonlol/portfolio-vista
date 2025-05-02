import { Component } from '@angular/core';

@Component({
  selector: 'app-calculator',
  templateUrl: './calculator.component.html',
  styleUrls: ['./calculator.component.css'],
})
export class CalculatorComponent {
  expression = '';
  history: string[] = [];

  press(char: string) {
    this.expression += char;
  }

  op(operator: string) {
    if (!this.expression) return;
    const last = this.expression.slice(-1);
    if ('+-*/'.includes(last)) {
      this.expression = this.expression.slice(0, -1);
    }
    this.expression += operator;
  }

  clear() {
    this.expression = '';
  }

  clearEntry() {
    const match = this.expression.match(/(\d+\.?\d*)$/);
    if (match) {
      this.expression = this.expression.slice(0, -match[0].length);
    }
  }

  back() {
    this.expression = this.expression.slice(0, -1);
  }

  toggleSign() {
    const match = this.expression.match(/(\d+\.?\d*)$/);
    if (!match) return;
    const num = match[0];
    const toggled = (-+num).toString();
    this.expression = this.expression.slice(0, -num.length) + toggled;
  }

  calc() {
    try {
      const safeExpr = this.expression.replace(/(\d+\.?\d*)/g, '$1');
      const result = Function(`return ${safeExpr}`)();
      this.history.unshift(`${this.expression} = ${result}`);
      this.expression = result.toString();
    } catch {
      this.expression = 'Error';
    }
  }
}
