#!/bin/bash

# Prompt for commit message
echo "Enter commit message:"
read commit_message

# Add all changes, commit, and push
git add .
git commit -m "$commit_message"
git push origin master
