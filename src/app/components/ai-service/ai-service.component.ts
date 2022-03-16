import { Component, Input, OnInit } from '@angular/core';
import { AbstractControl, ControlContainer, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { AIService } from 'src/app/services/aiconfig.service';

@Component({
  selector: 'app-ai-service',
  templateUrl: './ai-service.component.html',
  styleUrls: ['./ai-service.component.scss'],
})
export class AiServiceComponent implements OnInit {

  
  _service: AIService;

  @Input() set service(service: AIService) {
    this._service = service;
    this.serviceForm.setValue({name: this._service.name, description: this._service.description, repoUrl: this._service.repo_url, repoEntrypoint: this._service.repo_entry_point, version: this._service.repo_version, parameters: JSON.stringify(this._service.additional_parameters, null, 4)});
  }

  get service() {
    return this._service;
  }

  @Input()
  readonly = true;

  serviceForm = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.pattern(/^[^\s].*$/)]),
    description: new FormControl('', [Validators.required, Validators.pattern(/.*\w.*/)]), 
    repoUrl: new FormControl('', [Validators.required, Validators.pattern("^((ssh|http(s)?)|)(:(\/\/)?)((\w|\.|@|\:|\/|\-|~)+)(\.git)(\/)?$")]), 
    repoEntrypoint: new FormControl('', [Validators.required, Validators.pattern(/\w+/)]),
    version: new FormControl('', [Validators.required, Validators.pattern(/^(([0-9a-f]{1,40})|(\w+)|(v[0-9](\.[0-9])*))$/)]),
    parameters: new FormControl('', [Validators.required,
      (control: AbstractControl) => {
        let valid = true;
        try {
          JSON.parse(control.value)
        } catch(e) {
          valid = false;
        }
        return !valid ? {notJSON: {value: control.value}} : null
      }
     ])
  });

  constructor() {
  }

  ngOnInit() {}

}
