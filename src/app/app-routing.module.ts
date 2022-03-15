import { AuthGuard } from './guards/auth.guard';
import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'seg-track',
    loadChildren: () => import('./home/home.module').then( m => m.HomePageModule),
    canActivate: [AuthGuard]
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadChildren: () => import('./pages/login/login.module').then( m => m.LoginPageModule),
  },
  {
    path: 'omero-dashboard',
    loadChildren: () => import('./pages/omero-dashboard/omero-dashboard.module').then( m => m.OmeroDashboardPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'omero-project',
    loadChildren: () => import('./pages/omero-project/omero-project.module').then( m => m.OmeroProjectPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'omero-dataset',
    loadChildren: () => import('./pages/omero-dataset/omero-dataset.module').then( m => m.OmeroDatasetPageModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'ai-config',
    loadChildren: () => import('./pages/ai-config/ai-config.module').then( m => m.AiConfigPageModule)
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules, relativeLinkResolution: 'legacy' })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
