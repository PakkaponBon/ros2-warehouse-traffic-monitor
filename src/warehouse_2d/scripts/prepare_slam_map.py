#!/usr/bin/env python3
"""Create a browser-compatible PNG beside a saved ROS occupancy map."""

import argparse
from pathlib import Path

from PIL import Image
import yaml


def prepare_map(yaml_path):
    """Convert the image referenced by a map YAML file to PNG."""
    yaml_path = Path(yaml_path).expanduser().resolve()
    metadata = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
    source = Path(metadata["image"]).expanduser()
    if not source.is_absolute():
        source = yaml_path.parent / source
    if not source.is_file():
        raise FileNotFoundError(f"map image does not exist: {source}")
    destination = yaml_path.with_suffix(".png")
    Image.open(source).convert("RGB").save(destination, optimize=True)
    return destination


def main():
    """Parse the map path and print the generated PNG filename."""
    parser = argparse.ArgumentParser()
    parser.add_argument("map_yaml", help="YAML file created by map_saver_cli")
    arguments = parser.parse_args()
    print(prepare_map(arguments.map_yaml))


if __name__ == "__main__":
    main()
