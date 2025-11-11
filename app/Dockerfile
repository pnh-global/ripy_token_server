FROM node:20-alpine

# PM2를 전역으로 설치
RUN npm install -g pm2

# 작업 디렉토리 설정
WORKDIR /app

# package.json 복사 및 의존성 설치
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# 전체 소스 코드 복사
COPY . .

# 환경 변수
ENV PORT=4000

# 포트 노출
EXPOSE 4000 4001

# 애플리케이션 시작
CMD ["pm2-runtime", "start", "server.js", "--name", "ripy-app"]
# CMD ["node", "server.js"]