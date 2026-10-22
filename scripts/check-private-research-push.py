#!/usr/bin/env python3
"""Reject pushes whose reachable history contains local-only analysis files."""
import fnmatch
from pathlib import PurePosixPath
import subprocess
import sys

PATTERNS = (
    "artifacts/*",
    "docs/player-stats-efficiency-comparison.md",
    "docs/player-stats-efficiency-inference.md",
    "docs/player-stats-public-rating-formulas.md",
    "docs/rating-formulas-NOTICE.md",
    "data/player-efficiency-inverse-research.json",
    "data/player-rating-research.json",
    "scripts/research-efficiency-inverse.py",
    "scripts/research-rating-formulas.py",
    "docs/research-strategy-plan.md",
    "data/reward-analysis*.json",
    "scripts/reward_analysis/*",
    "*效率计算分析报告.*",
    "*战雷收益分析报告.*",
    "*efficiency-analysis.md",
    "*reward-analysis-report.*",
)


def check(revision):
    result = subprocess.run(
        ["git", "-c", "core.quotePath=false", "rev-list", "--objects", revision],
        check=True, capture_output=True, text=True,
    )
    blocked = set()
    for line in result.stdout.splitlines():
        _, separator, name = line.partition(" ")
        if separator and any(fnmatch.fnmatchcase(name, pattern) for pattern in PATTERNS):
            blocked.add(str(PurePosixPath(name)))
    return blocked


def main():
    if sys.argv[1:2] == ["--check"]:
        revisions = sys.argv[2:]
        if not revisions:
            raise ValueError("--check requires at least one revision")
    else:
        revisions = []
        for line in sys.stdin:
            parts = line.split()
            if len(parts) != 4:
                raise ValueError("Invalid pre-push reference record")
            local_sha = parts[1]
            if local_sha.strip("0"):
                revisions.append(local_sha)
    blocked = set()
    for revision in set(revisions):
        blocked.update(check(revision))
    if blocked:
        print("Push blocked: local-only research exists in the proposed history:", file=sys.stderr)
        for name in sorted(blocked):
            print("  " + name, file=sys.stderr)
        print("Keep local copies and remove these paths from history before pushing.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, subprocess.CalledProcessError) as error:
        print("Private research push check failed: " + str(error), file=sys.stderr)
        sys.exit(1)
