import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { AbstractControl, ControlContainer, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AIConfigService, AIService } from 'src/app/services/aiconfig.service';

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

  @Output()
  save = new EventEmitter<AIService>();

  @Output()
  delete = new EventEmitter<AIService>();

  @Output()
  customize = new EventEmitter<AIService>();

  customizable$: Observable<boolean>;

  serviceForm = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.pattern(/^[^\s].*$/)]),
    description: new FormControl('', [Validators.required, Validators.pattern(/.*\w.*/)]), 
    repoUrl: new FormControl('', [Validators.required, Validators.pattern("^((ssh|http(s)?)|)(:(\/\/)?)((\w|\.|@|\:|\/|\-|~)+)(\.git)(\/)?$")]), 
    repoEntrypoint: new FormControl('', [Validators.required, Validators.pattern(/\w+/)]),
    version: new FormControl('', [Validators.required, Validators.pattern(/^(([0-9a-f]{1,40})|(\w+)|(v[0-9](\.[0-9])*))$/)]),
    parameters: new FormControl('', [Validators.required,
      (control: AbstractControl) => {
        // make sure we can parse the string as json
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

  constructor(private aiConfigService: AIConfigService) {
  }

  ngOnInit() {
    // see whether the service is already stored and we can customize it
    this.customizable$ = this.aiConfigService.hasServiceSaved(this.service.id);
  }

  discardChanges() {
    this.service = this._service;
  }

  onSubmit() {
    const newService = new AIService(
      this.serviceForm.controls['name'].value,
      this.serviceForm.controls['description'].value,
      this.serviceForm.controls['repoUrl'].value,
      this.serviceForm.controls['repoEntrypoint'].value,
      this.serviceForm.controls['version'].value,
      JSON.parse(this.serviceForm.controls['parameters'].value),
      this.service.id
    );
    this.save.emit(newService);
    //this.aiConfigService.saveService(line, newService);
  }

  deleteService() {
    this.delete.emit(this.service);
  }

  customizeService() {
    this.customize.emit(this.service);
  }

}
