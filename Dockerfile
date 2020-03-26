FROM registry.access.redhat.com/ubi8/nodejs-10:1

WORKDIR /app-root
COPY . .
RUN npm i

EXPOSE 4000
CMD ["npm", "start"]