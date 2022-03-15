import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { BehaviorSubject, Observable, ReplaySubject } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { deserialize, JsonProperty, Serializable } from 'typescript-json-serializer';

@Serializable()
export class SegmentationServiceDef {
  /** name of the segmentation method as displayed to the user */
  @JsonProperty()
  name: string;

  /** description of the segmentation method displayed to the user */
  @JsonProperty()
  description: string;

  /** git repository url where to find the code */
  @JsonProperty()
  repo_url: string;

  /** entrypoint of the git repo. */
  @JsonProperty()
  repo_entry_point: string;

  /** Repo version/branch */
  @JsonProperty()
  repo_version: string;

  /** additional parameters specified by the approach */
  @JsonProperty()
  additional_parameters: { [name: string]: string }
}

@Serializable()
export class AIService {
  @JsonProperty()
  name: string;
  @JsonProperty()
  description: string;
  @JsonProperty()
  repo_url: string;
  @JsonProperty()
  repo_entry_point: string;
  @JsonProperty()
  repo_version: string;
  @JsonProperty()
  additional_parameters: {[name: string]: string};
}

@Serializable()
export class Line {
  @JsonProperty()
  name: string;
  @JsonProperty()
  description: string;
  @JsonProperty({type: AIService})
  services: Array<AIService>;
  @JsonProperty({name: "read-only"})
  readonly: boolean;
};

@Serializable()
export class AIConfig {
  @JsonProperty({ isDictionary: true, type: Line })
  lines: {[name: string]: Line}
}

@Component({
  selector: 'app-ai-config',
  templateUrl: './ai-config.page.html',
  styleUrls: ['./ai-config.page.scss'],
})
export class AiConfigPage implements OnInit {

  constructor(private httpClient: HttpClient) { }

  _selectedLine: string = "Default";

  set selectedLine(name: string) {
    this._selectedLine = name;
    this.lineName$.next(this._selectedLine);
  }
  get selectedLine(): string {
    return this._selectedLine;
  }

  lineName$ = new BehaviorSubject<string>(this._selectedLine);

  lineNames$: Observable<string[]>;
  line$: Observable<Line>;
  services$: Observable<Array<AIService>>;
  readonly$: Observable<boolean>;

  ngOnInit() {
    //this.httpClient.get('assets/ai-lines.json').subscribe((res) => console.log(res))

    this.lineNames$ = this.httpClient.get('assets/ai-lines.json').pipe(
      map(res => Object.keys(res['lines']))
    );

    this.line$ = this.lineName$.pipe(
      switchMap((lineName: string) => {
        return this.httpClient.get('assets/ai-lines.json').pipe(
          map((res) => {
            console.log(res)
            return {response: res, lineName}
          })
        )
      }),
      map(({response, lineName}) => {
        return deserialize(response['lines'][lineName], Line);
      })
    );

    this.readonly$ = this.line$.pipe(
      map((line: Line) => {
        console.log(line.readonly);
        return line.readonly
      })
    );

    this.services$ = this.line$.pipe(
      map((line: Line) => {
        return line.services;
      })      
    );
  }

}
