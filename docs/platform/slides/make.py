"""Draws every animation and still of the deck into out/.

    python3 docs/platform/slides/make.py              # all of them
    python3 docs/platform/slides/make.py depth kill   # some of them
"""
import importlib
import sys

MODULES = ["scenes_core", "scenes_story", "scenes_physical", "scenes_proof", "scenes_lean", "scenes_std", "scenes_std_devops", "scenes_std_overview", "scenes_std_design"]

ALL = {}
for name in MODULES:
    try:
        ALL.update(importlib.import_module(name).SCENES)
    except ModuleNotFoundError as error:
        if error.name != name:
            raise

if __name__ == "__main__":
    for key in sys.argv[1:] or ALL:
        ALL[key]()
