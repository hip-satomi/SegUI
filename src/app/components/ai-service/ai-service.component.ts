import { Component, Input, OnInit } from '@angular/core';
import { AIService } from 'src/app/pages/ai-config/ai-config.page';

@Component({
  selector: 'app-ai-service',
  templateUrl: './ai-service.component.html',
  styleUrls: ['./ai-service.component.scss'],
})
export class AiServiceComponent implements OnInit {

  @Input()
  service: AIService;

  @Input()
  readonly = true;

  constructor() { }

  ngOnInit() {}

}
