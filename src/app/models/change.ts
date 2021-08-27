import { EventEmitter } from '@angular/core';
import { Observable } from 'rxjs';
export enum ChangeType {
    SOFT,
    HARD
}

export class ModelChanged<T> {
    model: T;
    changeType: ChangeType;

    constructor(model: T, changeType: ChangeType) {
        this.model = model;
        this.changeType = changeType;
    }
}

export interface ChangableModel<T> {
    modelChanged: Observable<ModelChanged<T>>;
}
