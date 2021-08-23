FROM node:12

COPY ./src ./app/src
COPY ./*.json ./app/

RUN cd app && npm ci

RUN cd app && npm install -g @angular/cli @ionic/cli
RUN cd app && ls
RUN cd app && ionic build --prod

FROM nginx

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d

COPY --from=0 ./app/www /www
