import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { deserialize, JsonProperty, Serializable } from 'typescript-json-serializer';
import { v4 as uuidv4 } from 'uuid';
import { UserQuestionsService } from './user-questions.service';
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
  @JsonProperty()
  id: string = uuidv4();

  constructor(name: string, description: string, repo_url: string, repo_entry_point: string, repo_version: string, additional_parameters: {[name: string]: string}, id: string=null) {
    this.name = name;
    this.description = description;
    this.repo_url = repo_url;
    this.repo_entry_point = repo_entry_point;
    this.repo_version = repo_version;
    this.additional_parameters = additional_parameters;
    if (id !== null && id !== undefined) {
      this.id = id;
    } else {
      this.id = uuidv4();
    }
  }
}

@Serializable()
export class AILine {
  @JsonProperty()
  name: string;
  @JsonProperty()
  description: string;
  @JsonProperty({type: AIService})
  services: Array<AIService>;
  @JsonProperty({name: "read-only"})
  readonly: boolean;
  @JsonProperty()
  id: string = uuidv4();

  constructor(name: string, description: string, services: Array<AIService>, readonly: boolean, id: string = null) {
    this.name = name;
    this.description = description;
    this.services = services;
    this.readonly = readonly;
  
    if (id !== null && id !== undefined) {
      this.id = id;
    } else {
      this.id = uuidv4();
    }
  }
};

@Serializable()
export class AIConfig {
  @JsonProperty({ isDictionary: true, type: AILine })
  lines: {[name: string]: AILine}
}


@Injectable({
  providedIn: 'root'
})
export class AIConfigService {

  constructor(private httpClient: HttpClient,
    private userQuestion: UserQuestionsService) {}

  getConfig(): Observable<AIConfig> {
    return this.getShippedConfig();
  }

  getShippedConfig(): Observable<AIConfig> {
    return this.httpClient.get('assets/ai-lines.json').pipe(
      map((res) => deserialize(res, AIConfig))
    )
  }

  saveService(line: AILine, service: AIService) {
    this.userQuestion.showInfo(`Saved service '${service.name}' in line '${line.name}'`)
  }

  deleteService(line: AILine, service: AIService) {
    this.userQuestion.showInfo(`Delete service '${service.name}' in line '${line.name}'`)
  }
}
