all: build | silent

import:
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
	@if [ -d /media/$(USER)/internet-class/backup ]; then \
		echo "Backing up to /media/$(USER)/internet-class/"; \
		rsync -av videos/backup /media/$(USER)/internet-class/ ; \
	fi
	@if [ -d /mnt/storage/internet-class/backup ]; then \
		echo "Backing up to /mnt/storage/internet-class/"; \
		rsync -av videos/backup /mnt/storage/internet-class/ ; \
	fi

credentials:
	@node lib/youtube_credentials.js youtube/credentials.json youtube/tokens.json

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
