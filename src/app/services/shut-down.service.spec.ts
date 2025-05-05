import { TestBed } from '@angular/core/testing';

import { ShutDownService } from './shut-down.service';

describe('ShutDownService', () => {
  let service: ShutDownService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ShutDownService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
