# segTrackUI

Web Application for high-quality and interactive microbial cell segmentation and tracking. The application is based on the [Ionic](https://ionicframework.com/) and [Anglar](https://angular.io/) frameworks.

## Installation Procedure

1. Install Node.js and npm (https://nodejs.org/en/)

2. Clone this repository

```
git clone https://jugit.fz-juelich.de/j.seiffarth/segtrackui
cd segtrackui
```

3. Install all dependencies

```
npm install
```

4. Launch the development server

```
ionic serve
```

## Important notes

The segTrackUI is only functionable with an [OMERO](https://www.openmicroscopy.org/omero/) server as data backend. Furthermore, the ionic server is not recommended for deployment. Please use a secure web server, for example, [nginx](https://www.nginx.com/).