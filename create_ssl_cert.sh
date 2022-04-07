#!/usr/bin/env bash -xe

openssl req -x509 \
	-newkey rsa:4096 -sha256 -days 3650 -nodes \
	-keyout private/example.key \
	-out certs/example.crt \
	-subj "/CN=localhost"

