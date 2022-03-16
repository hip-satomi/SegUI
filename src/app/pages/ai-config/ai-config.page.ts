import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { BehaviorSubject, Observable, ReplaySubject, throwError } from 'rxjs';
import { map, switchMap, take, tap } from 'rxjs/operators';
import { AIConfig, AIConfigService, AIService, AILine } from 'src/app/services/aiconfig.service';
import { UserQuestionsService } from 'src/app/services/user-questions.service';

@Component({
  selector: 'app-ai-config',
  templateUrl: './ai-config.page.html',
  styleUrls: ['./ai-config.page.scss'],
})
export class AiConfigPage implements OnInit, ViewWillEnter {

  constructor(private configService: AIConfigService,
    private route: ActivatedRoute,
    private userQuestion: UserQuestionsService,
    private router: Router) { }

  @ViewChild('content') private content: any;

  _selectedLine: string = "Default";

  set selectedLine(name: string) {
    this.lineNames$.subscribe((names) => {
      if (names.includes(name)) {
        this._selectedLine = name;
        this.lineName$.next(this._selectedLine);
      } else {
        this.userQuestion.showError(`Cannot select line ${name}. It is not in the database!`)
      }
    });
  }

  get selectedLine(): string {
    return this._selectedLine;
  }

  lineName$ = new BehaviorSubject<string>(this._selectedLine);
  cachedConfig$ = new BehaviorSubject<AIConfig>(null);

  lineNames$: Observable<string[]>;
  line$: Observable<AILine>;
  services$: Observable<Array<AIService>>;
  readonly$: Observable<boolean>;

  config$ = new ReplaySubject<AIConfig>(1);
  config: AIConfig;

  ngOnInit() {
    this.configService.getConfig().pipe(
      tap((config) => this.config$.next(config))
    ).subscribe();

    this.lineNames$ = this.config$.pipe(
      map(res => res.lines.map(line => line.name))
    );

    this.line$ = this.lineName$.pipe(
      switchMap((lineName: string) => {
        return this.config$.pipe(
          map((config) => {
            return config.lines.filter(line => line.name == lineName)[0];
          })
        )
      }),
    );

    this.readonly$ = this.line$.pipe(
      map((line: AILine) => {
        console.log(line.readonly);
        return line.readonly
      })
    );

    this.services$ = this.line$.pipe(
      map((line: AILine) => {
        return line.services;
      })      
    );
  }

  ionViewWillEnter() {
    this.route.paramMap.subscribe(params => {
      console.log(params);
      if (params.has("line")) {
        this.selectedLine = params.get("line");
      }
      if (params.has("add_line") && params.has("add_service")) {
        // we want to clone the service into our current line
        this.line$.pipe(
          take(1),
          switchMap((line) => {
            if (line.readonly) {
              return throwError(Error("Line is read-only! Cannot add customized model"));
            } else {
              return this.config$;
            }
          }),
          map((config: AIConfig) => {
            const line_id = params.get("add_line");
            const line_candidates = config.lines.filter((line) => line.id == line_id);

            if (line_candidates.length == 1) {
              return line_candidates[0];
            } else {
              throw new Error("Error while finding source line");
            }            
          }),
          map((line: AILine) => {
            const service_id = params.get("add_service");
            const service_candidates = line.services.filter((service) => service.id == service_id);

            if (service_candidates.length == 1) {
              return service_candidates[0];
            } else {
              throw new Error("Error while finding source service")
            }
          }),
          tap((service_to_clone: AIService) => {
            const service_copy = service_to_clone.dubplicate();
            service_copy.name += " - Customized"
            this.addService(service_copy);
          })
        ).subscribe(
          () => this.userQuestion.showInfo("Please customize the segmentation method!"),
          (e) => this.userQuestion.showError(`Error while customizing: ${e.message}`)
        );
      }
    });
  }

  addService(service: AIService = null) {
    this.line$.pipe(
      take(1),
      tap((line: AILine) => {
        if (service == null) {
          service = new AIService("", "", "", "", "", {});
        }
        
        line.services.push(service);
        setTimeout(() => this.content.scrollToBottom(300), 250)    
      })
    ).subscribe();
  }

  updateService(service: AIService) {
    this.line$.pipe(
      take(1),
      tap((line: AILine) => {
        this.configService.saveService(line, service);
      })
    ).subscribe(); 
  }

  deleteService(service: AIService) {
    this.line$.pipe(
      take(1),
      tap((line: AILine) => {
        this.configService.deleteService(line, service);
      })
    ).subscribe(); 
  }

  customizeService(service: AIService) {
    this.line$.pipe(
      take(1),
      tap((line: AILine) => {
        this.router.navigate(['./', {"line": "Custom", add_line: line.id, add_service: service.id}]);
      })
    ).subscribe();
  }

}
