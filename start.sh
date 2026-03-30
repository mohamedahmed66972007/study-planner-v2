#!/bin/bash
# Start the API server in the background
export PORT=3000
export NODE_ENV=development
(cd /home/runner/workspace/artifacts/api-server && pnpm run dev) &
API_PID=$!

# Wait for API server to be ready
sleep 3

# Start the frontend
export PORT=5000
export BASE_PATH=/
export API_PORT=3000
cd /home/runner/workspace/artifacts/study-planner-extension && pnpm run dev
