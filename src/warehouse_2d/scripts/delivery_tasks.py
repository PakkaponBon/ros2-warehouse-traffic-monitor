"""Pickup/drop-off job scheduling independent of ROS and Gazebo."""

from collections import deque
from dataclasses import dataclass
import math
from pathlib import Path

import yaml


def transform_xy(x, y, dx=0.0, dy=0.0, yaw=0.0):
    """Transform Gazebo world coordinates into the saved map frame."""
    c, s = math.cos(yaw), math.sin(yaw)
    return (c * x - s * y + dx, s * x + c * y + dy)


def load_delivery_config(path):
    """Validate docking points, spawn poses, dwell times, and queued jobs."""
    data = yaml.safe_load(Path(path).expanduser().read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("delivery config must be a YAML mapping")
    stations = data.get("stations", [])
    spawns = data.get("spawns", [])
    if not stations or not spawns:
        raise ValueError("delivery config requires stations and spawns")
    ids = [station["id"] for station in stations]
    if len(set(ids)) != len(ids):
        raise ValueError("station IDs must be unique")
    for points, keys in ((stations, ("x", "y")), (spawns, ("x", "y", "yaw"))):
        for point in points:
            for key in keys:
                if not math.isfinite(float(point[key])):
                    raise ValueError(f"non-finite {key} in delivery config")
    flows = data.get("production_flows")
    if flows is not None:
        if not isinstance(flows, list) or not flows:
            raise ValueError("production_flows requires at least one flow")
        visited = set()
        jobs = []
        for flow in flows:
            if not isinstance(flow, list) or len(flow) < 2:
                raise ValueError("each production flow requires at least two stations")
            if any(station not in ids for station in flow):
                raise ValueError("production flow references an unknown station")
            if visited.intersection(flow) or len(set(flow)) != len(flow):
                raise ValueError("production flows must use unique stations")
            visited.update(flow)
            jobs.extend({"pickup": start, "dropoff": end}
                        for start, end in zip(flow, flow[1:]))
        data["jobs"] = jobs
    else:
        jobs = data.get("jobs", [])
        if not jobs:
            raise ValueError("delivery config requires at least one job")
    for job in jobs:
        if job["pickup"] not in ids or job["dropoff"] not in ids:
            raise ValueError("job references an unknown station")
        if job["pickup"] == job["dropoff"]:
            raise ValueError("pickup and dropoff must be different stations")
    for key in ("loading_seconds", "unloading_seconds"):
        value = float(data.get(key, 4.0))
        if not math.isfinite(value) or not 0.0 <= value <= 600.0:
            raise ValueError(f"{key} must be between 0 and 600")
        data[key] = value
    if not isinstance(data.get("repeat_jobs", True), bool):
        raise ValueError("repeat_jobs must be a boolean")
    return data


@dataclass
class DeliveryTask:
    task_id: str
    pickup: str
    dropoff: str
    phase: str = "to_pickup"
    deadline: float = 0.0

    @property
    def carrying(self):
        return self.phase in {"to_dropoff", "unloading"}


class DeliveryFleet:
    """Reserve both docks for each job and progress only at its destination."""

    def __init__(self, config, names, alignment=(0.0, 0.0, 0.0)):
        self.stations = {
            station["id"]: {
                "label": station.get("label", station["id"]),
                "point": transform_xy(float(station["x"]), float(station["y"]),
                                      *alignment),
            }
            for station in config["stations"]
        }
        self.flows = [tuple(flow) for flow in config.get("production_flows", [])]
        self.workflow_for_job = {
            (flow[index], flow[index + 1]): (flow_number, index)
            for flow_number, flow in enumerate(self.flows)
            for index in range(len(flow) - 1)
        }
        if self.flows:
            self.pending = deque((flow[0], flow[1]) for flow in self.flows)
        else:
            self.pending = deque((job["pickup"], job["dropoff"])
                                 for job in config["jobs"])
        self.repeat = config.get("repeat_jobs", True)
        self.loading_seconds = config["loading_seconds"]
        self.unloading_seconds = config["unloading_seconds"]
        self.tasks = dict.fromkeys(names)
        self.completed = dict.fromkeys(names, 0)
        self.sequence = 0

    def assign(self, name, positions):
        """Assign a job only when neither endpoint belongs to another truck."""
        if self.tasks[name] is not None or name not in positions:
            return None
        reserved = {
            station
            for other, task in self.tasks.items()
            if other != name and task is not None
            for station in (task.pickup, task.dropoff)
        }
        # A completed truck still occupies its dock until it physically leaves.
        for other, pose in positions.items():
            if other == name:
                continue
            for station, entry in self.stations.items():
                if math.dist(pose[:2], entry["point"]) < 1.2:
                    reserved.add(station)
        for _ in range(len(self.pending)):
            pickup, dropoff = self.pending.popleft()
            if pickup in reserved or dropoff in reserved:
                self.pending.append((pickup, dropoff))
                continue
            self.sequence += 1
            task = DeliveryTask(f"delivery-{self.sequence:04d}", pickup, dropoff)
            self.tasks[name] = task
            return task
        return None

    def target(self, name):
        task = self.tasks[name]
        if task is None or task.phase in {"loading", "unloading"}:
            return None
        station = task.pickup if task.phase == "to_pickup" else task.dropoff
        return self.stations[station]["point"]

    def advance(self, name, position, now, tolerance=0.25):
        """Advance with simulation time; return a transition for logging."""
        task = self.tasks[name]
        if task is None:
            return None
        if task.phase in {"to_pickup", "to_dropoff"}:
            if math.dist(position[:2], self.target(name)) > tolerance:
                return None
            task.phase = "loading" if task.phase == "to_pickup" else "unloading"
            dwell = self.loading_seconds if task.phase == "loading" else self.unloading_seconds
            task.deadline = now + dwell
            return task.phase
        # Loading/unloading requires the truck to remain at its assigned dock.
        station = task.pickup if task.phase == "loading" else task.dropoff
        if math.dist(position[:2], self.stations[station]["point"]) > tolerance:
            task.phase = "to_pickup" if task.phase == "loading" else "to_dropoff"
            return task.phase
        if now < task.deadline:
            return None
        if task.phase == "loading":
            task.phase = "to_dropoff"
            return task.phase
        self.completed[name] += 1
        if self.flows:
            flow_number, index = self.workflow_for_job[(task.pickup, task.dropoff)]
            flow = self.flows[flow_number]
            if index + 2 < len(flow):
                self.pending.append((flow[index + 1], flow[index + 2]))
            elif self.repeat:
                self.pending.append((flow[0], flow[1]))
        elif self.repeat:
            self.pending.append((task.pickup, task.dropoff))
        self.tasks[name] = None
        return "completed"

    def vehicle_status(self, name):
        task = self.tasks[name]
        return {
            "vehicle_id": name,
            "task_id": task.task_id if task else None,
            "phase": task.phase if task else "idle",
            "pickup": task.pickup if task else None,
            "dropoff": task.dropoff if task else None,
            "carrying": bool(task and task.carrying),
            "completed_jobs": self.completed[name],
        }
