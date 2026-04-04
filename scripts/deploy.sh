#!/usr/bin/env bash
set -euo pipefail

target_commit_sha="${1:-}"
if [ -z "${target_commit_sha}" ]; then
  echo "[deploy] Usage: ./scripts/deploy.sh <commit-sha>"
  exit 1
fi

deploy_app_dir="${DEPLOY_APP_DIR:-/opt/openclaw-config-helper}"
deploy_branch_name="${DEPLOY_BRANCH:-main}"
restart_command="${DEPLOY_RESTART_COMMAND:-}"
health_check_command="${DEPLOY_HEALTH_CHECK_COMMAND:-}"

echo "[deploy] Starting deployment."
echo "[deploy] App directory: ${deploy_app_dir}"
echo "[deploy] Branch: ${deploy_branch_name}"
echo "[deploy] Target commit: ${target_commit_sha}"

if [ ! -d "${deploy_app_dir}" ]; then
  echo "[deploy] App directory does not exist: ${deploy_app_dir}"
  exit 1
fi

cd "${deploy_app_dir}"

if [ ! -d ".git" ]; then
  echo "[deploy] App directory is not a git repository."
  exit 1
fi

echo "[deploy] Fetching repository updates."
git fetch --prune origin

if ! git rev-parse --verify --quiet "${target_commit_sha}^{commit}" >/dev/null; then
  echo "[deploy] Commit not found locally after fetch: ${target_commit_sha}"
  exit 1
fi

echo "[deploy] Checking out target commit."
git checkout --detach "${target_commit_sha}"

echo "[deploy] Installing dependencies."
npm ci

echo "[deploy] Building application."
npm run build

if [ -n "${restart_command}" ]; then
  echo "[deploy] Restarting runtime with command: ${restart_command}"
  bash -lc "${restart_command}"
else
  echo "[deploy] No restart command configured; skipping runtime restart."
fi

if [ -n "${health_check_command}" ]; then
  echo "[deploy] Running health check command: ${health_check_command}"
  bash -lc "${health_check_command}"
else
  echo "[deploy] No health check command configured; skipping health check."
fi

echo "[deploy] Deployment completed successfully for ${target_commit_sha}."
