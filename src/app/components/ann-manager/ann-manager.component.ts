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

  /** Reference to global segmentation model */
  @Input() globalSegModel: GlobalSegmentationModel;

  constructor(private userQuestions: UserQuestionsService) { }

  ngOnInit() {}

  /**
   * Add a new label
   */
  addLabel() {

    // start with cell label
    const names = this.labels.map(l => l.name);
    let newName: string = 'Cell';

    // choose appropriate number if label name already exists
    if (names.includes(newName)) {
        for (let i = 1; names.includes(newName); i += 1) {
            newName = `Cell ${i}`;
        }
    }

    // add label to the seg model
    this.globalSegModel.addAction(new AddLabelAction(new AnnotationLabel(this.globalSegModel.nextLabelId(), newName, true, 'random', true)));
  }

  beginHover(label: AnnotationLabel) {
    console.log(`begin Hover: ${label}.name`);
  }

  endHover(label: AnnotationLabel) {
    console.log(`end Hover ${label}.name`);
  }

  changeVisibility(label: AnnotationLabel, visible: boolean) {
    this.globalSegModel.addAction(new ChangeLabelVisibilityAction(label.id, visible));
  }

  get labels(): Array<AnnotationLabel> {
    return this.globalSegModel.labels;
  }

  changeActivity(label: AnnotationLabel, active: boolean) {
    if (label.active == active) {
      // if we already have the correct activity state skip
      return;
    }

    // set active label
    this.globalSegModel.addAction(new ChangeLabelActivityAction(label.id, active));
  }

  changeLabelName(label: AnnotationLabel, newName: string) {
    // does the new name already exist?
    const candidates = this.globalSegModel.labels.filter(l => l.name == newName);
    if (candidates.length > 0) {
        // ask the user whether he wants to merge labels
        this.userQuestions.mergeLabels(label.name, candidates[0].name).pipe(
            tap((result: boolean) => {
                if(result) {
                    this.globalSegModel.addAction(new MergeLabelAction(label.id, candidates[0].id));
                }
            })
        ).subscribe();
    } else {
        // just change the name
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
