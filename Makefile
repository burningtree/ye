NODE = node
NPM = npm
LINTER = node_modules/.bin/eslint
MOCHA = node_modules/.bin/mocha

all: build browser

install:
	$(NPM) install

build:
	@make lint test-silent

lint:
	$(LINTER) lib/*.js bin/ye.js

test: test/*
	$(MOCHA)

test-silent:
	$(MOCHA) -R dot

help:
	@echo ""
	@echo " Available commands:"
	@echo "   all install build lint test test-silent help"
	@echo "   bench lint test-silent"
	@echo ""

