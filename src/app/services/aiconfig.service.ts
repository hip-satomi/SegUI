import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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


@Injectable({
  providedIn: 'root'
})
export class AIConfigService {

  constructor(private httpClient: HttpClient) {}

  getConfig(): Observable<AIConfig> {
    return this.getShippedConfig();
  }

  getShippedConfig(): Observable<AIConfig> {
    return this.httpClient.get('assets/ai-lines.json').pipe(
      map((res) => deserialize(res, AIConfig))
    )
  }
}
