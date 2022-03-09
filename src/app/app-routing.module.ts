import { AuthGuard } from './guards/auth.guard';
import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'seg-track',
    loadChildren: () => import('./home/home.module').then( m => m.HomePageModule),
    //canActivate: [AuthGuard]
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'list',
    loadChildren: () => import('./pages/image-set-list/image-set-list.module').then( m => m.ImageSetListPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'login',
    loadChildren: () => import('./pages/login/login.module').then( m => m.LoginPageModule)
  },
  {
    path: 'omero-dashboard',
    loadChildren: () => import('./pages/omero-dashboard/omero-dashboard.module').then( m => m.OmeroDashboardPageModule)
  },
  {
    path: 'omero-project',
    loadChildren: () => import('./pages/omero-project/omero-project.module').then( m => m.OmeroProjectPageModule)
  },
  {
    path: 'omero-dataset',
    loadChildren: () => import('./pages/omero-dataset/omero-dataset.module').then( m => m.OmeroDatasetPageModule)
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules, relativeLinkResolution: 'legacy' })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
