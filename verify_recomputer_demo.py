#!/usr/bin/env python3
"""Read live HTTP telemetry and measure physical fleet movement for a demo."""
import argparse
import json
import math
from pathlib import Path
import time
from urllib.request import urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:8080')
    parser.add_argument('--vehicles', type=int, default=4)
    parser.add_argument('--seconds', type=float, default=60)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if not 1 <= args.vehicles <= 8 or not math.isfinite(args.seconds) or args.seconds < 5:
        parser.error('vehicles must be 1..8 and seconds must be finite and at least 5')
    if args.output and args.output.exists():
        parser.error('output already exists; choose a new filename')
    names = {f'vehicle_{i}' for i in range(1, args.vehicles + 1)}
    records, clocks = {}, []
    deadline = time.monotonic() + args.seconds
    latest = None
    errors = []
    while time.monotonic() < deadline:
        try:
            with urlopen(args.url.rstrip('/') + '/api/tasks/delivery', timeout=3) as response:
                latest = json.load(response)
            with urlopen(args.url.rstrip('/') + '/api/health', timeout=3) as response:
                health = json.load(response)
            if not latest.get('online') or latest.get('mode') != 'roam':
                raise ValueError('roaming fleet is offline or wrong mode')
            if {v['vehicle_id'] for v in latest.get('vehicles', [])} != names:
                raise ValueError('fleet size differs from --vehicles')
            clocks.append((time.monotonic(), latest['sim_time']))
            for vehicle in health.get('vehicles', []):
                name = vehicle['vehicle_id']
                if name not in names:
                    continue
                reference = vehicle.get('gazebo_validation') or {}
                point = reference.get('reference_position')
                if point is None:
                    continue
                xy = (point['x'], point['y'])
                record = records.setdefault(name, {'first': xy, 'last': xy, 'travel_m': 0.0,
                                                  'max_displacement_m': 0.0, 'ever_ready': False})
                record['travel_m'] += math.dist(record['last'], xy)
                record['max_displacement_m'] = max(record['max_displacement_m'], math.dist(record['first'], xy))
                record['last'] = xy
                record['ever_ready'] |= reference.get('drive_allowed') is True
        except (OSError, ValueError, KeyError, TypeError) as error:
            errors.append(str(error))
            print(f'Telemetry: {error}', flush=True)
        time.sleep(min(2, max(0, deadline - time.monotonic())))
    ratio = None
    if len(clocks) > 1 and clocks[-1][0] > clocks[0][0]:
        ratio = (clocks[-1][1] - clocks[0][1]) / (clocks[-1][0] - clocks[0][0])
    passed = (set(records) == names and latest is not None and latest.get('online')
              and not errors and all(r['ever_ready'] and r['max_displacement_m'] > .5 for r in records.values()))
    report = {'passed': bool(passed), 'approximate_simulation_wall_ratio': ratio,
              'vehicles': records, 'coverage': latest and latest.get('coverage'),
              'completed_goals': None if latest is None else {
                  v['vehicle_id']: v.get('completed_goals', 0) for v in latest.get('vehicles', [])},
              'telemetry_errors': errors}
    print(json.dumps(report, indent=2))
    if args.output:
        with args.output.open('x') as output:
            json.dump(report, output, indent=2)
            output.write('\n')
    if ratio is not None and ratio < .8:
        print('Review performance: measured simulation/wall ratio is below 0.8.')
    raise SystemExit(0 if passed else 1)


if __name__ == '__main__':
    main()
