import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { BehaviorSubject, Observable, ReplaySubject } from 'rxjs';
import { map, switchMap, take, tap } from 'rxjs/operators';
import { AIConfig, AIConfigService, AIService, Line } from 'src/app/services/aiconfig.service';
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
  line$: Observable<Line>;
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
      tap((line: Line) => {
        line.services.push(
          new AIService("", "", "", "", "", {})
        );    
      })
    ).subscribe();
  }

}
