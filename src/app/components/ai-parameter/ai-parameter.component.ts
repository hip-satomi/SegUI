import { Component, Input, OnInit } from '@angular/core';

class Parameter {
  name: string;
  value: string;

  constructor(name: string, value: string) {
    this.name = name;
    this.value = value;
  }
}

@Component({
  selector: 'app-ai-parameter',
  templateUrl: './ai-parameter.component.html',
  styleUrls: ['./ai-parameter.component.scss'],
})
export class AiParameterComponent implements OnInit {

  _parameters: { [param_name: string]: string };

  @Input()
  readonly = true;

  @Input()
  set parameters(parameters) {
    console.log(parameters);
    this._parameters = parameters;
  }

  get parameterList() {
    if (this._parameters == null) {
      return [];
    }
    const params: Array<Parameter> = [];
    for (let [key, value] of Object.entries(this._parameters)) {
      params.push(new Parameter(key, value));
    }
    return params;
  }

  constructor() { }

  ngOnInit() {}

}
