#!/usr/bin/env python3
"""Collect Windows host metrics from WSL2 and write to a JSON file.

This script runs on the WSL2 host (not in Docker) and uses powershell.exe
to fetch accurate Windows system metrics. The JSON file is volume-mounted
into the gateway container.

Usage:
    python3 scripts/wsl-metrics-collector.py
    make metrics-collector
"""

import json
import subprocess
import sys
import time
from pathlib import Path

METRICS_FILE = Path("/tmp/orion-host-metrics.json")
INTERVAL = 2  # seconds


def get_windows_metrics() -> dict:
    """Fetch RAM, disk, and CPU from Windows via PowerShell."""
    script = """
    $os = Get-CimInstance Win32_OperatingSystem
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
    $cpu = (Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average
    @{
        memory_total = $os.TotalVisibleMemorySize * 1024
        memory_free = $os.FreePhysicalMemory * 1024
        memory_used = ($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) * 1024
        disk_total = $disk.Size
        disk_free = $disk.FreeSpace
        disk_used = $disk.Size - $disk.FreeSpace
        cpu_usage = $cpu
        source = "windows_host"
        timestamp = (Get-Date -Format o)
    } | ConvertTo-Json
    """
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if result.returncode != 0:
        raise RuntimeError(f"PowerShell failed: {result.stderr}")
    return json.loads(result.stdout)


def main() -> None:
    print(f"WSL Metrics Collector — writing to {METRICS_FILE} every {INTERVAL}s")
    print("Press Ctrl+C to stop.")
    while True:
        try:
            metrics = get_windows_metrics()
            METRICS_FILE.write_text(json.dumps(metrics, indent=2))
        except KeyboardInterrupt:
            print("\nStopped.")
            break
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
