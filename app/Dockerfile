FROM node:20-alpine
WORKDIR /usr/src/app

COPY package*.json ./
# lockfile 있으면 ci, 없으면 install
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY . .

ENV PORT=4000
EXPOSE 4000 4001
CMD ["node","server.js"]
