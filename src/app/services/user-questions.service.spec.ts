import { TestBed } from '@angular/core/testing';

import { UserQuestionsService } from './user-questions.service';

describe('UserQuestionsService', () => {
  let service: UserQuestionsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UserQuestionsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
