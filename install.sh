#!/bin/bash

# Nook App Installer
# This script installs the built app to /Applications
# and the Claude skill to ~/.claude/skills

APP_NAME="Nook.app"
BUILD_PATH="build/bin/$APP_NAME"
INSTALL_PATH="/Applications/$APP_NAME"

SKILL_NAME="nook-jq"
SKILL_SOURCE=".claude/skills/$SKILL_NAME"
SKILL_DEST="$HOME/.claude/skills/$SKILL_NAME"

echo "🚀 Installing Nook..."

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
    echo "✅ Nook has been successfully installed to /Applications!"
    echo "You can now launch it from Launchpad or Spotlight."
else
    echo "❌ Installation failed. You may need to run with sudo:"
    echo "   sudo ./install.sh"
    exit 1
fi

# Install Claude skill
echo ""
echo "🔧 Installing Claude skill..."

if [ ! -d "$SKILL_SOURCE" ]; then
    echo "⚠️  Warning: $SKILL_SOURCE not found. Skipping skill installation."
else
    # Create ~/.claude/skills directory if it doesn't exist
    mkdir -p "$HOME/.claude/skills"

    # Remove existing skill if present
    if [ -d "$SKILL_DEST" ]; then
        echo "📦 Removing existing skill installation..."
        rm -rf "$SKILL_DEST"
    fi

    # Copy the skill
    cp -r "$SKILL_SOURCE" "$SKILL_DEST"

    if [ $? -eq 0 ]; then
        echo "✅ Claude skill '$SKILL_NAME' installed to ~/.claude/skills/"
    else
        echo "❌ Failed to install Claude skill."
    fi
fi
