import { Injectable } from '@angular/core';
import { ActionSheetButton, ActionSheetController, AlertController } from '@ionic/angular';
import { from, Observable, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { AnnotationLabel } from '../models/segmentation-data';
import { GlobalSegmentationModel, LocalSegmentationModel } from '../models/segmentation-model';

@Injectable({
  providedIn: 'root'
})
export class UserQuestionsService {

  constructor(private actionSheetController: ActionSheetController,
    private alertController: AlertController) { }

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
      switchMap(as => from(as.onDidDismiss())),
      map((result): string => result['role']),
      tap((role) => {
        console.log(role)
      }),
      map((role: string) => {
        if (['cancel', 'backdrop'].includes(role)) {
          throw new Error('User canceled creation');
        } else {
          return Number(role);
        }
      }),
      map((labelId: number) => localSegModel.parent.labels.filter(l => l.id == labelId)[0]),
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

  mergeLabels(srcName: string, dstName: string): Observable<boolean> {
    return from(this.alertController.create({
      cssClass: 'my-custom-class',
      header: 'Merge Labels',
      //subHeader: 'Subtitle',
      message: `Do you really want to merge the labels '${srcName}' and '${dstName}'`,
      buttons: [
        {
          text: 'Yes',
          role: 'confirm',
        },
        {
          text: 'No',
          role: 'cancel'
        }
      ]
    })).pipe(
      tap(alert => {
        alert.present()
      }),
      switchMap(alert => {
        return from(alert.onDidDismiss())
      }),
      map(data => {
        return data['role']
      }),
      map(role => role == 'confirm')
    );
  }
}
