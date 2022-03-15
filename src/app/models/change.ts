import { Observable } from 'rxjs';
export enum ChangeType {
    SOFT, // changes that only require a screen update (e.g. zooming)
    HARD // changes that need to be saved in backend
}

/**
 * ModelChanged message that contains the changed model and information about the change type
 */
export class ModelChanged<T> {
    model: T;
    changeType: ChangeType;

    constructor(model: T, changeType: ChangeType) {
        this.model = model;
        this.changeType = changeType;
    }
}

/**
 * Interface for a model that notifies when changes happen
 */
export interface ChangableModel<T> {
    modelChanged: Observable<ModelChanged<T>>;
}
