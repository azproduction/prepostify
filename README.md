# Prepostify

Resizes and squareups selected images to 2048px long edge  

## Requirements

- node 20.x
- yarn

## Install

```sh
yarn
```

## Create Automator "Quick Action"

Workflow receives current "Image files" in "Finder"

Run Shell Script

Pass input: "as arguments"

```sh
PATH="/usr/local/bin:$PATH"
cd /path/to/prepostify
./src/index.ts "$@"
```
