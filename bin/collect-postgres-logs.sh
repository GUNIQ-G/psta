#!/bin/bash

# PostgreSQL Docker Container Log Collector
# This script collects logs from psta-postgres container

LOG_DIR="/log/psta/database"
CONTAINER_NAME="psta-postgres"
LOG_FILE="$LOG_DIR/postgresql-$(date +%Y-%m-%d).log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Collect logs from Docker container
# Follow logs in real-time and append to file
docker logs -f "$CONTAINER_NAME" >> "$LOG_FILE" 2>&1 &

echo "PostgreSQL logs are being collected to: $LOG_FILE"
echo "Process ID: $!"
