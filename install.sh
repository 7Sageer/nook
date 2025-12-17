#!/bin/bash

# Nostalgia App Installer
# This script installs the built app to /Applications

APP_NAME="nostalgia.app"
BUILD_PATH="build/bin/$APP_NAME"
INSTALL_PATH="/Applications/$APP_NAME"

echo "🚀 Installing Nostalgia..."

# Check if the built app exists
if [ ! -d "$BUILD_PATH" ]; then
    echo "❌ Error: $BUILD_PATH not found."
    echo "Please run 'wails build' first."
    exit 1
fi

# Remove existing installation if present
if [ -d "$INSTALL_PATH" ]; then
    echo "📦 Removing existing installation..."
    rm -rf "$INSTALL_PATH"
fi

# Copy the app to Applications
echo "📋 Copying $APP_NAME to /Applications..."
cp -r "$BUILD_PATH" "$INSTALL_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Nostalgia has been successfully installed to /Applications!"
    echo "You can now launch it from Launchpad or Spotlight."
else
    echo "❌ Installation failed. You may need to run with sudo:"
    echo "   sudo ./install.sh"
    exit 1
fi
