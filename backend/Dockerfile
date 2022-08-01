FROM golang:1.18-alpine3.15 AS Build

WORKDIR /app

COPY . .

RUN go build -o main .



FROM alpine:3.15

WORKDIR /app

COPY --from=Build /app/main .

EXPOSE 50000

CMD [ "./main" ]