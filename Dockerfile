FROM node:20

WORKDIR /alerts
COPY package.json yarn.lock ./
RUN yarn install
COPY . .

RUN yarn build

LABEL org.opencontainers.image.source=https://github.com/notlet/alerts
LABEL org.opencontainers.image.description="air raid alerts"
LABEL org.opencontainers.image.licenses=MIT

ENTRYPOINT ["yarn", "start"]