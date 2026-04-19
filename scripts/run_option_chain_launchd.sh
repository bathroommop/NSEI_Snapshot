#!/bin/zsh
set -euo pipefail

cd "/Users/aryanayyar/Library/CloudStorage/GoogleDrive-aryan.ayyar.learner@gmail.com/My Drive/Data/NSEI/NSEI_Snapshot"
exec "$PWD/.venv/bin/python" scripts/run_option_chain_day.py --symbol NIFTY --symbol BANKNIFTY --symbol FINNIFTY
