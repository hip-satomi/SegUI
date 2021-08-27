## Run in docker container

Assuming that the omero web interface is served at `localhost:4080`

```
docker build -f docker/Dockerfile -t segtrack .
docker run --rm -it --network="host" -e OMERO_URL="localhost:4080" segtrack
```