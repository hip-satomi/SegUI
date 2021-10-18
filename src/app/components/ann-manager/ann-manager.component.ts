import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { tap } from 'rxjs/operators';
import { AddLabelAction, ChangeLabelActivityAction, ChangeLabelColorAction, ChangeLabelVisibilityAction, DeleteLabelAction, JointAction, MergeLabelAction, RenameLabelAction } from 'src/app/models/action';
import { AnnotationLabel } from 'src/app/models/segmentation-data';
import { GlobalSegmentationModel } from 'src/app/models/segmentation-model';
import { UserQuestionsService } from 'src/app/services/user-questions.service';

@Component({
  selector: 'app-ann-manager',
  templateUrl: './ann-manager.component.html',
  styleUrls: ['./ann-manager.component.scss'],
})
export class AnnManagerComponent implements OnInit {

  //@Input() labels: AnnotationLabel[];
  @Input() globalSegModel: GlobalSegmentationModel;

  @Output() redraw = new EventEmitter<void>();

  constructor(private userQuestions: UserQuestionsService) { }

  ngOnInit() {}

  addLabel() {
    const names = this.labels.map(l => l.name);
    let newName: string = 'Cell';

    if (names.includes(newName)) {
        for (let i = 1; names.includes(newName); i += 1) {
            newName = `Cell ${i}`;
        }
    }

    this.globalSegModel.addAction(new AddLabelAction(new AnnotationLabel(this.globalSegModel.nextLabelId(), newName, true, 'random', true)));
  }

  beginHover() {
    console.log('begin Hover');
  }

  endHover() {
    console.log('end Hover');
  }

  changeVisibility(label: AnnotationLabel, visible: boolean) {
    this.globalSegModel.addAction(new ChangeLabelVisibilityAction(label.id, visible));

    this.redraw.emit();
  }

  get labels(): Array<AnnotationLabel> {
    return this.globalSegModel.labels;
  }

  changeActivity(label: AnnotationLabel, active: boolean) {
    if (label.active) {
      return;
    }

    this.globalSegModel.addAction(new ChangeLabelActivityAction(label.id, active));
  }

  changeLabelName(label: AnnotationLabel, newName: string) {
    // does the new name already exist?
    const candidates = this.globalSegModel.labels.filter(l => l.name == newName);
    if (candidates.length > 0) {
        this.userQuestions.mergeLabels(label.name, candidates[0].name).pipe(
            tap((result: boolean) => {
                if(result) {
                    this.globalSegModel.addAction(new MergeLabelAction(label.id, candidates[0].id));
                }
            })
        ).subscribe();
    } else {
        this.globalSegModel.addAction(new RenameLabelAction(label.id, newName));
    }
  }

  changeLabelColor(label: AnnotationLabel, color: string) {
    this.globalSegModel.addAction(new ChangeLabelColorAction(label.id, color));
  }

  deleteLabel(label) {
    if (this.globalSegModel.labels.length >= 2) {
      // enough labels to delete one
      this.globalSegModel.addAction(new DeleteLabelAction(label.id));
    } else {
      this.userQuestions.showError('Cannot delete label! You only have one');
    }
  }

}
