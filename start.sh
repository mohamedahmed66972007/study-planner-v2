#!/bin/bash
# Start the API server in the background
export PORT=3000
export NODE_ENV=development
(cd /home/runner/workspace/artifacts/api-server && pnpm run dev) &
API_PID=$!

