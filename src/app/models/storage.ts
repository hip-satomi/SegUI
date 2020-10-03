/**
 * The storage connector handles the representation of an object in a storage e.g. database, local storage or rest api
 */
export abstract class StorageConnector<M> {
    protected model: M;

    /**
     * Bind the storage connector with a specific model instance
     * @param model the model instance
     */
    constructor(model: M) {
        this.model = model;
    }

    /**
     * Should be called when the model changes and updates the object representation
     */
    abstract update();

    getModel(): M {
        return this.model;
    }
}

/**
 * Synchronized object e.g. with database, rest api, local storage
 */
export class SynchronizedObject<Model> {
    /**
     * List of storage connectors to e.g. database, rest api, local storage
     */
    connectors: StorageConnector<Model>[] = [];

    /**
     * Attaches a new storage connector to this object
     * @param storageConnector storage connector object
     */
    attach(storageConnector: StorageConnector<Model>) {
        this.connectors.push(storageConnector);
    }

    /**
     * Updates the object representation in all storages
     */
    update() {
        for (const storageConnector of this.connectors) {
            storageConnector.update();
        }
    }
}

