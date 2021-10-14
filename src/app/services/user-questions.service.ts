import { Injectable } from '@angular/core';
import { ActionSheetButton, ActionSheetController } from '@ionic/angular';
import { from, Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { AnnotationLabel } from '../models/segmentation-data';
import { GlobalSegmentationModel, LocalSegmentationModel } from '../models/segmentation-model';

@Injectable({
  providedIn: 'root'
})
export class UserQuestionsService {

  constructor(private actionSheetController: ActionSheetController) { }

  askForSingleLabel(localSegModel: LocalSegmentationModel): Observable<AnnotationLabel> {

    const buttons = localSegModel.labels.map((l): ActionSheetButton => {
      return {
        text: l.name,
        role: `${l.id}`,
      };
    });

    return from(this.actionSheetController.create({
      header: 'Select a label...',
      //cssClass: 'my-custom-class',
      buttons: [...buttons, {
        text: 'Cancel',
        icon: 'close',
        role: 'cancel',
        handler: () => {
          console.log('Cancel clicked');
        }
      }]
    })).pipe(
      tap(as => as.present()),
      map(as => from(as.onDidDismiss())),
      tap((role) => console.log(role)),
      map(() => localSegModel.segmentationData.labels[0]),
    )
  }

  activeLabel(localSegModel: LocalSegmentationModel): Observable<AnnotationLabel> {
    const activeLabels = localSegModel.activeLabels;
    if (activeLabels.length == 1) {
      return of(activeLabels[0])
    } else {
      return this.askForSingleLabel(localSegModel);
    }
  }
}
