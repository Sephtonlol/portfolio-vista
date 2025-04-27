import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Window } from '../interfaces/window.interface';

@Injectable({
  providedIn: 'root',
})
export class WindowManagerService {
  private itemsSource = new BehaviorSubject<Window[]>([]);
  items$ = this.itemsSource.asObservable();

  addItem(item: Window) {
    const currentItems = this.itemsSource.value;
    this.itemsSource.next([...currentItems, item]);
  }
}
