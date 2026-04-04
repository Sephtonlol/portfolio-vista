import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-lock-screen',
  imports: [FormsModule],
  templateUrl: './lock-screen.component.html',
  styleUrl: './lock-screen.component.css',
})
export class LockScreenComponent {
  passwordHidden = false;
  password = '';

  togglePasswordHidden() {
    this.passwordHidden = !this.passwordHidden;
  }

  signIn() {
    console.log(this.password);
  }
}
