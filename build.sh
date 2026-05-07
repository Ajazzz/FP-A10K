#!/usr/bin/env bash

set -o errexit

echo "Installing frontend dependencies..."
cd frontend
npm install

echo "Building frontend..."
npm run build

cd ..

echo "Copying frontend build to backend/static..."
rm -rf backend/static
mkdir -p backend/static

cp -r frontend/dist/* backend/static/

echo "Installing backend dependencies..."
pip install -r requirements.txt