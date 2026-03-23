#!/bin/sh

# This script sets up the data-model build environment

# working dir fix
scriptsFolder=$(cd $(dirname "$0"); pwd)
cd $scriptsFolder/..

# check for well known prereqs that might be missing
hash git 2>&- || { echo >&2 "I require git."; exit 1; }
hash npm 2>&- || { echo >&2 "I require node and npm."; exit 1; }

echo "
Installing Node modules from 'package.json' if necessary...
"
npm install

if [ ! -d dist/.git ]
then
  echo "
Setting up 'dist' folder for publishing to GitHub pages...
"
  rm -rf dist
  git clone -b gh-pages git@github.com:healthdatasafe/data-model.git dist
fi

echo "


If no errors were listed above, the setup is complete.
See the README for more info on writing and publishing.
"
