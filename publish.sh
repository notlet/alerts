#! /bin/bash

docker image build -t ghcr.io/notlet/alerts:latest .
docker push ghcr.io/notlet/alerts:latest

echo 👍