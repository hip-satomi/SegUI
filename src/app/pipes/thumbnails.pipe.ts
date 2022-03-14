import { Pipe, PipeTransform } from '@angular/core';
import { Dataset, OmeroAPIService, Project } from '../services/omero-api.service';

/**
 * pipe to extract thumbnail urls for omero projects or datasets
 */
@Pipe({
  name: 'thumbnails'
})
export class ThumbnailsPipe implements PipeTransform {

  constructor(private omeroAPI: OmeroAPIService) {}

  transform(item: Project | Dataset, ...args: unknown[]) {
    if (item instanceof Project) {
      return this.omeroAPI.getProjectThumbnailUrls(item.id);
    } else {
      return this.omeroAPI.getDatasetThumbnailUrls(item.id);
    }
  }

}
