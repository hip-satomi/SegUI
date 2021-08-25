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

## How to Test the UI - Use a docker container

We automatically build a docker container that serves the `segTrackUI`. Make sure you have [docker](https://docs.docker.com/get-docker/) installed and perform the following steps to get it running

1. Please login at the container registry

    ```
    docker login jugit-registry.fz-juelich.de
    ```
    and enter your credentials. It might be that you have to [configure a user password](https://docs.gitlab.com/ee/user/profile/) in jugit to make the authentication work. If this does not work you can still ask for a [password reset](https://jugit.fz-juelich.de/-/profile/password/reset).

2. Launch the UI server and connect it with omero

    The UI server needs the location of the omero server specified in the `OMERO_URL` environment variable. Thus the code snippet below launches an UI server that connects to the omero server at `localhost:4080` (4080 is the default omero web port)

    ```
    docker run --rm -it --network host -e OMERO_URL=localhost:4080 --pull newer jugit-registry.fz-juelich.de/satomi/segtrackui/server:latest
    ```

    *Note:* This command will always fetch the latest docker container from the registry.
    *Note:* The docker container uses the host network. Thus we do not recommend this setup for production usage!

3. Now the segTrackUI is available under [localhost:80](http://localhost).

## Auto-login and Redirect

To automatically login you can specify the username, password and redirect url as parameters. For example, your `segTrackUI` instance runs at `localhost` and you want to immeditely jump to segment image sequence (omero:Image) `201`, use

```
http://localhost/login?u=<username>&p=<password>&r=/seg-track;imageSetId=201
```

where you replace `username` and `password` by your specific credentials.

*Note:* username and password will occur in your browser history!
## Important notes

The segTrackUI is only functionable with an [OMERO](https://www.openmicroscopy.org/omero/) server as data backend. Furthermore, the ionic server is not recommended for deployment. Please use a secure web server, for example, [nginx](https://www.nginx.com/).