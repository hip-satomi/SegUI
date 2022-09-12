import { Component, Inject, OnInit, Optional } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { BehaviorSubject, ReplaySubject, Subject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { OmeroAPIService, OmeroType } from 'src/app/services/omero-api.service';

@Component({
  selector: 'app-import-dialog',
  templateUrl: './import-dialog.component.html',
  styleUrls: ['./import-dialog.component.scss'],
})
export class ImportDialogComponent implements OnInit {

  imageId: number;

  omeroRoICount$ = new BehaviorSubject<number>(0);
  simpleSegAvailable$ = new BehaviorSubject<boolean>(false);

  public static IMPORT_SEG_OMERO = "segOMERO";
  public static IMPORT_SEG_SIMPLE = "segSimple";
  public static IMPORT_SEG_FILE = "segFile"

  public cR = ImportDialogComponent;

  constructor(@Optional() public dialogRef: MatDialogRef<ImportDialogComponent>,
              @Inject(MAT_DIALOG_DATA) public data: {imageId: number},
            private omeroAPI: OmeroAPIService) {
    this.imageId = data.imageId;
  }

  ngOnInit() {
    // check OMERO RoI count
    this.omeroAPI.getImageInfo(this.imageId).pipe(
      tap(info => {
        this.omeroRoICount$.next(info.roiCount)
      })
    ).subscribe();

    // check simple seg file annotation
    this.omeroAPI.getFileAnnotations(this.imageId, OmeroType.Image).pipe(
      tap(annotations => {
        this.simpleSegAvailable$.next(
          // check whether a file with the correct name is available
          annotations.filter(ann => ann.file.name == "pred_simpleSegmentation.json").length == 1
        );
      })
    ).subscribe();
  }

  close(result) {
    this.dialogRef.close(result);
  }
}
