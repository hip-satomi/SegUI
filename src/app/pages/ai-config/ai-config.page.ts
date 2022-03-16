import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { BehaviorSubject, Observable, ReplaySubject } from 'rxjs';
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
    private userQuestion: UserQuestionsService) { }

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
      map(res => Object.keys(res.lines))
    );

    this.line$ = this.lineName$.pipe(
      switchMap((lineName: string) => {
        return this.config$.pipe(
          map((config) => {
            return config.lines[lineName]
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
    this.route.queryParams.subscribe(params => {
      console.log(params);
      if ("line" in params) {
        this.selectedLine = params["line"];
      }
    });
  }

  addService() {
    this.line$.pipe(
      take(1),
      tap((line: AILine) => {
        line.services.push(
          new AIService("", "", "", "", "", {})
        );
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

}
