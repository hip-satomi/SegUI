# SegUI

Web Application for high-quality, interactive and semi-automated microbial cell segmentation utilizing the [Omero](https://www.openmicroscopy.org/omero/) data management backend. The application is based on the [Ionic](https://ionicframework.com/) and [Anglar](https://angular.io/) frameworks.

**Hint**: For a production setup see https://github.com/hip-satomi/ObiWan-Microbi.git

## Local Installation Procedure for Development

1. Install Node.js and npm (https://nodejs.org/en/)

2. Clone this repository

```
git clone https://github.com/hip-satomi/SegUI.git
cd SegUI
```

3. Install all dependencies

```
npm install
```

4. Launch the development server

```
ionic serve
```

## Auto-login and Redirect

To automatically login you can specify the username, password and redirect url as parameters. For example, your `segTrackUI` instance runs at `localhost` and you want to immeditely jump to segment image sequence (omero:Image) `201`, use

```
http://localhost/login?u=<username>&p=<password>&r=/seg-track;imageSetId=201
```

where you replace `username` and `password` by your specific credentials.

*Note:* username and password will occur in your browser history!

## Important notes

`SegUI` is only functionable with an [OMERO](https://www.openmicroscopy.org/omero/) server as data backend. Furthermore, the ionic server is not recommended for deployment. Please use a secure web server, for example, [nginx](https://www.nginx.com/).
