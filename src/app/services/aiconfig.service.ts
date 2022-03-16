import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
import { map, share, shareReplay, take, tap } from 'rxjs/operators';
import { serialize, deserialize, JsonProperty, Serializable } from 'typescript-json-serializer';
import { v4 as uuidv4 } from 'uuid';
import { Utils } from '../models/utils';
import { StorageService } from './storage.service';
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

  /**
   * 
   * @returns duplicate of the service with a new unique id
   */
  dubplicate(): AIService {
    const copy = Utils.clone(this) as AIService;
    copy.id = uuidv4();

    return copy;
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
  @JsonProperty({type: AILine })
  lines: Array<AILine>;
}


@Injectable({
  providedIn: 'root'
})
export class AIConfigService {

  STORAGE_KEY = "AIConfig";

  config$ = new ReplaySubject<AIConfig>(1);

  constructor(private httpClient: HttpClient,
    private userQuestion: UserQuestionsService,
    private storageService: StorageService) {
      this.init();
  }

  async init() {
    this.storageService.available$.pipe(
      take(1),
      tap(async () => {
        const isStored = await this.storageService.has(this.STORAGE_KEY);
        if (!isStored) {
          // we not yet have a config in the storage
          this.getShippedConfig().pipe(
            tap(async (config: AIConfig) => {
              await this.storeConfig(config);
              console.log("Create new storage!")
            }),
            tap(config => {
              this.config$.next(config);
            })
          ).subscribe();
        } else {
          console.log("Use existing storage!")
          this.config$.next(await this.loadConfig())
        }
      })
    ).subscribe();
  }

  getConfig(): Observable<AIConfig> {
    return this.config$;
  }

  getShippedConfig(): Observable<AIConfig> {
    return this.httpClient.get('assets/ai-lines.json').pipe(
      map((res) => deserialize(res, AIConfig))
    )
  }

  private async storeConfig(config: AIConfig) {
    return await this.storageService.set(this.STORAGE_KEY, serialize(config));
  }

  private async loadConfig() {
    return deserialize(await this.storageService.get(this.STORAGE_KEY), AIConfig);
  }

  saveService(line: AILine, service: AIService) {
    this.config$.pipe(
      take(1),
      map(config => {
        const index = config.lines.indexOf(line);
        
        if (index == -1) {
          throw new Error("Did not find line! Would need to create it!");
        }

        const serviceIndex = line.services.indexOf(service);

        if (index == -1) {
          // service is not in the line --> just add it
          line.services.push(service);
        } else {
          // service is in line --> replace it
          line.services[serviceIndex] = service;
        }

        return config;
      }),
      tap(async (config) => await this.storeConfig(config))
    ).subscribe(() => {this.userQuestion.showInfo(`Saved service '${service.name}' in line '${line.name}'`)});
    
  }

  deleteService(line: AILine, service: AIService) {
    this.userQuestion.showInfo(`Delete service '${service.name}' in line '${line.name}'`)
  }

  hasService(serviceId: string): Observable<boolean> {
    return this.getConfig().pipe(
      take(1),
      map((config: AIConfig) => {
        return [].concat(...config.lines.map(line => line.services)).filter((service: AIService) => service.id == serviceId).length == 1;
      })
    )
  }
}
