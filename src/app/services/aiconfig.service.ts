import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { from, Observable, of, ReplaySubject } from 'rxjs';
import { map, share, shareReplay, switchMap, take, tap } from 'rxjs/operators';
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

  hasService(serviceId: string) {
    return this.services.map(service => service.id).includes(serviceId);
  }

  deleteServiceById(serviceId: string) {
    if (this.hasService(serviceId)) {
      const index = this.services.map(service => service.id).indexOf(serviceId);
      this.services.splice(index, 1);
    } else {
      console.warn("AI service cannot be deleted from this line");
    }
  }

  getServiceById(serviceId: string): AIService | null  {
    const candidates = this.services.filter(s => s.id == serviceId);
    if (candidates.length == 1) {
      return candidates[0];
    } else {
      return null;
    }
  }

  setServiceById(serviceId: string, service) {
    const index = this.services.map(s => s.id).indexOf(serviceId);
    if (index == -1) {
      console.warn("Cannot set service: id not found!");
    } else {
      this.services[index] = service;
    }
  }

};

@Serializable()
export class AIConfig {
  @JsonProperty({type: AILine })
  lines: Array<AILine>;

  getLineById(id: string): AILine {
    return this.lines.filter(line => line.id == id)[0];
  }

  setLineById(id: string, line: AILine) {
    const lineIndex = this.lines.map(line => line.id).indexOf(line.id);
    this.lines[lineIndex] = line;
  }

  hasLine(lineId: string) {
    return this.lines.map(line => line.id).includes(lineId);
  }
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
      switchMap(async () => {
        const isStored = await this.storageService.has(this.STORAGE_KEY);
        if (!isStored) {
          // we not yet have a config in the storage
          return this.getShippedConfig().pipe(
            tap(async (config: AIConfig) => {
              await this.storeConfig(config);
              console.log("Create new storage!")
            }),
          );
        } else {
          console.log("Use existing storage!")
          return of(await this.loadConfig());
        }
      }),
      // make the promise go away
      switchMap(config => config),
      // update from shipped
      switchMap((config: AIConfig) => {
        return this.getShippedConfig().pipe(
          map((shippedConfig) => {
            // update default line by the configurations shipped with segUI.
            const defaultLineId = "26403c2b-cdbb-44c8-9140-25a01841ee34";
            config.setLineById(defaultLineId, shippedConfig.getLineById(defaultLineId));
            console.log("Update default line!");
            return config;
          })
        )
      }),
      tap(config => {
        this.config$.next(config);
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

  /**
   * Saves a service in a line permanently into the storage.
   * 
   * This function only modifies and works with the config in storage!
   * 
   * @param line the line of the service
   * @param service the service to add
   */
  saveService(line: AILine, service: AIService) {
    this.getConfigFromStorage().pipe(
      take(1),
      map(config => {
        const storage_line = config.getLineById(line.id);
        
        if (storage_line == null) {
          throw new Error("Did not find line! Would need to create it!");
        }

        const storage_service = storage_line.getServiceById(service.id);

        if (storage_service == null) {
          // service is not in the line --> just add it
          storage_line.services.push(service);
        } else {
          // service is in line --> replace it
          storage_line.setServiceById(service.id, service);
        }

        return config;
      }),
      switchMap((config) => {
        // store config
        return from(this.storeConfig(config)).pipe(
          map(() => config)
        );
      }),
      tap(config => {
        this.config$.next(config)
      })
    ).subscribe(() => {this.userQuestion.showInfo(`Saved service '${service.name}' in line '${line.name}'`)});
    
  }

  /**
   * Deletes are service permanently from the line.
   * 
   * This function only operates on the stored config.
   * @param line the line to user
   * @param service the service to remove
   */
  deleteService(line: AILine, service: AIService) {
    this.getConfigFromStorage().pipe(
      take(1),
      map(config => {
        if(config.hasLine(line.id)) {
          if(line.hasService(service.id)) {
            line.deleteServiceById(service.id);
          }
        }
        return config;
      }),
      tap(async (config) => await this.storeConfig(config))
    ).subscribe(
      () => this.userQuestion.showInfo(`Delete service '${service.name}' in line '${line.name}'`)
    );    
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
