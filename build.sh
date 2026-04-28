#!/usr/bin/env bash
set -e

pip install -r requirements.txt

# go to frontend and build
cd frontend
npm install
npm run build

# go back to root
cd ..

# clean static folder
rm -rf backend/static
mkdir -p backend/static

# copy correctly (FIXED PATH)
cp -r frontend/dist/* backend/static/