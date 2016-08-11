all: build | silent

import:
	@mkdir -p videos/backup
	@chmod u+w videos/backup/
	@node lib/grab.js /media/$(USER)/CANON/AVCHD videos/backup videos
	@chmod a-w videos/backup/*
	@chmod a-w videos/backup/

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

.PHONY: run clean silent build
