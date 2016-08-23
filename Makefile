all: build | silent
SHELL := /usr/bin/env bash

doimport:
	@mkdir -p videos/backup
	@if [ -d /media/$(USER)/CANON/AVCHD/ ]; then \
		chmod u+w videos/backup/; \
		node lib/grab.js /media/$(USER)/CANON/AVCHD videos/backup videos; \
		chmod a-w videos/backup/*; \
		chmod a-w videos/backup/; \
	else \
		echo "/media/$(USER)/CANON/AVCHD does not exist."; \
	fi

backup:
	@node lib/dosync.js
	@if [ -d /media/$(USER)/internet-class/backup ]; then \
		echo "Backing up to /media/$(USER)/internet-class/"; \
		unison videos/backup/ /media/challen/internet-class/backup/ -prefer videos/backup/ -auto -batch -fastcheck true -silent -times ; \
	fi
	@if [ -d /mnt/storage/internet-class/backup ]; then \
		echo "Backing up to /mnt/storage/internet-class/"; \
		unison videos/backup/ /mnt/storage/internet-class/backup/ -prefer videos/backup/ -auto -batch -fastcheck true -silent -times ; \
	fi

previews:
	@mkdir -p videos/previews
	@shopt -s nullglob ; cd videos ; for f in *.{MTS,mp4}; do echo "$${f%.*}"; done | xargs -t -P 16 -I FILE bash -c "ffmpeg -n -i FILE.* -s qvga -c:v libx264 -crf 18 -pix_fmt yuv420p -preset ultrafast previews/FILE.preview.mp4 2>/dev/null || true"

import: doimport previews

credentials:
	@node lib/youtube_credentials.js youtube/credentials.json youtube/tokens.json
	@cp youtube/credentials.json youtube/tokens.json test/videos/fixtures/upload/

videos:
	@node lib/dovideos.js

build:
	@node lib/index.js $(DEPLOY) $(CHECK)
	@while [ -n "$(find .build -depth -type d -empty -print -exec rmdir {} +)" ]; do :; done
	@if [ -d ".build" ]; then \
		rsync -rlpgoDc --delete .build/ build 2>/dev/null; \
		rm -rf .build; \
	else \
		rm -rf build; \
	fi

deploy: DEPLOY = --deploy
deploy: check build

check: CHECK = --check
check: build

silent:
	@:

run:
	./node_modules/http-server/bin/http-server build -p 8082

clean:
	@rm -rf build deploy

.PHONY: run clean silent build credentials videos import backup
