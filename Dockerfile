FROM node:alpine

ADD package.json /app/package.json
ADD app.js /app/app.js

WORKDIR /app

RUN npm install

CMD ["node", "app.js"]