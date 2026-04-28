#!/usr/bin/env bash
set -e

pip install -r requirements.txt

cd frontend
npm install
npm run build

cd ..
rm -rf backend/static
mkdir -p backend/static
cp -r frontend/dist/* backend/static/