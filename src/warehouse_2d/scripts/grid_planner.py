"""Small occupancy-grid A* planner used by the simulated traffic fleet."""

from collections import Counter, defaultdict, deque
import heapq
import math
from pathlib import Path

from PIL import Image
import yaml


class OccupancyGridPlanner:
    """Plan collision-clear 2-D routes over a downsampled warehouse map."""

    def __init__(self, resolution, origin, width, height, free_cells):
        """
        Create a planner from a prepared set of free grid cells.

        Parameters
        ----------
        resolution : float
            Size of one grid cell in metres.
        origin : tuple
            World-space ``(x, y)`` coordinate of grid cell ``(0, 0)``.
        width : int
            Number of cells along the x axis.
        height : int
            Number of cells along the y axis.
        free_cells : iterable
            Cells that are safe to traverse.

        """
        self.resolution = float(resolution)
        self.origin = (float(origin[0]), float(origin[1]))
        self.width = int(width)
        self.height = int(height)
        self.free = set(free_cells)
        self.components = self._components()
        self.component_for = {
            cell: component
            for component, cells in self.components.items()
            for cell in cells
        }

    @classmethod
    def from_yaml(cls, map_yaml, planning_resolution=0.30, robot_radius=0.55):
        """
        Load a ROS map YAML/PGM pair and inflate its obstacles.

        The source image is downsampled to the requested planning resolution.
        Occupied and unknown pixels are marked as blocked, then blocked cells
        are expanded by the robot radius so the planned route has clearance.
        """
        yaml_path = Path(map_yaml).expanduser().resolve()
        metadata = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
        image_path = Path(metadata["image"])
        if not image_path.is_absolute():
            image_path = yaml_path.parent / image_path
        image = Image.open(image_path).convert("L")
        source_resolution = float(metadata["resolution"])
        scale = max(1, round(float(planning_resolution) / source_resolution))
        resolution = source_resolution * scale
        width = math.ceil(image.width / scale)
        height = math.ceil(image.height / scale)
        free_pixel = 255.0 * (1.0 - float(metadata.get("free_thresh", 0.25)))
        trinary = metadata.get("mode", "trinary") == "trinary"

        blocked = set()
        pixels = image.load()
        for pixel_y in range(image.height):
            grid_y = (image.height - 1 - pixel_y) // scale
            for pixel_x in range(image.width):
                pixel = pixels[pixel_x, pixel_y]
                # ROS map_saver writes unexplored trinary cells as grey 205.
                # The occupancy threshold alone would otherwise call them free.
                if pixel < free_pixel or (trinary and pixel == 205):
                    blocked.add((pixel_x // scale, grid_y))

        inflation = max(1, math.ceil(float(robot_radius) / resolution))
        inflated = set(blocked)
        for cell_x, cell_y in blocked:
            for offset_x in range(-inflation, inflation + 1):
                for offset_y in range(-inflation, inflation + 1):
                    if offset_x * offset_x + offset_y * offset_y <= inflation ** 2:
                        inflated.add((cell_x + offset_x, cell_y + offset_y))
        free = {
            (cell_x, cell_y)
            for cell_x in range(width)
            for cell_y in range(height)
            if (cell_x, cell_y) not in inflated
        }
        return cls(resolution, metadata["origin"], width, height, free)

    def _components(self):
        """Group free cells into connected regions using planner neighbours."""
        remaining = set(self.free)
        components = {}
        component_id = 0
        while remaining:
            component_id += 1
            start = remaining.pop()
            cells = {start}
            queue = deque([start])
            while queue:
                cell = queue.popleft()
                for neighbor, _cost in self._neighbors(cell, set()):
                    if neighbor in remaining:
                        remaining.remove(neighbor)
                        cells.add(neighbor)
                        queue.append(neighbor)
            components[component_id] = cells
        return components

    def world_to_cell(self, x, y):
        """Convert a world-space position in metres to a grid-cell index."""
        return (
            math.floor((float(x) - self.origin[0]) / self.resolution),
            math.floor((float(y) - self.origin[1]) / self.resolution),
        )

    def cell_to_world(self, cell):
        """Convert a grid-cell index to the world-space centre of that cell."""
        return (
            self.origin[0] + (cell[0] + 0.5) * self.resolution,
            self.origin[1] + (cell[1] + 0.5) * self.resolution,
        )

    def nearest_free(self, x, y, maximum_radius=20):
        """
        Find the closest traversable cell near a requested world position.

        A bounded search is used so an invalid spawn or route point does not
        cause an unbounded scan of a large map. ``None`` means no free cell was
        found within the search radius.
        """
        center = self.world_to_cell(x, y)
        if center in self.free:
            return center
        for radius in range(1, int(maximum_radius) + 1):
            candidates = []
            for offset in range(-radius, radius + 1):
                candidates.extend(
                    [
                        (center[0] + offset, center[1] - radius),
                        (center[0] + offset, center[1] + radius),
                        (center[0] - radius, center[1] + offset),
                        (center[0] + radius, center[1] + offset),
                    ]
                )
            free = [cell for cell in candidates if cell in self.free]
            if free:
                return min(
                    free,
                    key=lambda cell: (cell[0] - center[0]) ** 2
                    + (cell[1] - center[1]) ** 2,
                )
        return None

    def blocked_near(self, world_points, radius=1.1):
        """
        Convert dynamic world positions into temporary blocked cells.

        This is used to keep an A* route away from other vehicles that are
        currently occupying the map. It does not modify the static map.
        """
        blocked = set()
        cell_radius = math.ceil(float(radius) / self.resolution)
        for x, y in world_points:
            center = self.world_to_cell(x, y)
            for offset_x in range(-cell_radius, cell_radius + 1):
                for offset_y in range(-cell_radius, cell_radius + 1):
                    if offset_x * offset_x + offset_y * offset_y <= cell_radius ** 2:
                        blocked.add((center[0] + offset_x, center[1] + offset_y))
        return blocked

    def random_path(self, start_xy, random_source, dynamic_points=(), minimum_distance=6.0):
        """
        Choose a random reachable goal and return a simplified world path.

        Goals are selected from the start cell's connected component. The
        planner first tries to avoid temporary vehicle obstacles and then
        retries against the static map if those obstacles temporarily split an
        aisle. The returned path excludes the start point.
        """
        start = self.nearest_free(*start_xy)
        if start is None:
            return [], None
        component = self.component_for.get(start)
        candidates = list(self.components.get(component, ()))
        random_source.shuffle(candidates)
        temporary = self.blocked_near(dynamic_points)
        minimum_cells = float(minimum_distance) / self.resolution
        candidates = [
            cell
            for cell in candidates
            if math.hypot(cell[0] - start[0], cell[1] - start[1]) >= minimum_cells
            and cell not in temporary
        ]
        # Prefer a route that clears every current vehicle. A vehicle may
        # temporarily span a narrow aisle and disconnect the planning grid,
        # though, so fall back to the static map route in that case. The
        # controller's LiDAR and right-of-way layer still stops/replans when
        # it reaches that moving obstruction.
        for blocked in (temporary, set()):
            for goal in candidates[:80]:
                cells = self.plan_cells(start, goal, blocked)
                if cells:
                    cells = self._simplify(cells, blocked)
                    return (
                        [self.cell_to_world(cell) for cell in cells[1:]],
                        self.cell_to_world(goal),
                    )
        return [], None

    def path_to_goal(self, start_xy, goal_xy, dynamic_points=()):
        """Plan a simplified route between two world-space positions.

        Route endpoints are snapped to the nearest safe map cells. Dynamic
        vehicle positions are avoided when possible, with a static-map
        fallback so a temporarily blocked aisle does not invalidate a fixed
        route permanently.
        """
        start = self.nearest_free(*start_xy)
        goal = self.nearest_free(*goal_xy)
        if start is None or goal is None:
            return [], None
        temporary = self.blocked_near(dynamic_points)
        for blocked in (temporary, set()):
            cells = self.plan_cells(start, goal, blocked)
            if cells:
                cells = self._simplify(cells, blocked)
                return (
                    [self.cell_to_world(cell) for cell in cells[1:]],
                    self.cell_to_world(goal),
                )
        return [], self.cell_to_world(goal)

    def plan_cells(self, start, goal, temporary=()):
        """
        Run A* from ``start`` to ``goal`` and return a cell-by-cell route.

        ``temporary`` contains dynamic blocked cells for this one planning
        request. The static ``self.free`` map is never changed. An empty list
        means that either endpoint is invalid or no route exists.
        """
        return self.plan_weighted_cells(start, goal, {}, temporary)

    def plan_weighted_cells(self, start, goal, penalties, temporary=()):
        """
        Run A* while preferring cells with lower traffic penalties.

        ``penalties`` maps grid cells to non-negative extra traversal costs.
        A penalty does not make a cell impassable, so the planner can still
        use a busy aisle when the static warehouse map offers no alternative.
        ``temporary`` remains reserved for genuinely blocked cells.
        """
        blocked = set(temporary)
        blocked.discard(start)
        if start not in self.free or goal not in self.free or goal in blocked:
            return []
        queue = [(0.0, 0.0, start)]
        came_from = {}
        cost_so_far = {start: 0.0}
        while queue:
            _priority, current_cost, current = heapq.heappop(queue)
            if current == goal:
                path = [current]
                while current in came_from:
                    current = came_from[current]
                    path.append(current)
                return list(reversed(path))
            if current_cost > cost_so_far.get(current, math.inf):
                continue
            for neighbor, move_cost in self._neighbors(current, blocked):
                traffic_cost = max(0.0, float(penalties.get(neighbor, 0.0)))
                new_cost = current_cost + move_cost * (1.0 + traffic_cost)
                if new_cost >= cost_so_far.get(neighbor, math.inf):
                    continue
                cost_so_far[neighbor] = new_cost
                came_from[neighbor] = current
                heuristic = math.hypot(goal[0] - neighbor[0], goal[1] - neighbor[1])
                heapq.heappush(queue, (new_cost + heuristic, new_cost, neighbor))
        return []

    def _neighbors(self, cell, blocked):
        """
        Yield legal 8-connected neighbours and their movement costs.

        Diagonal motion is rejected when either orthogonal side is blocked,
        preventing the route from squeezing through an obstacle corner.
        """
        for offset_x, offset_y in (
            (-1, 0), (1, 0), (0, -1), (0, 1),
            (-1, -1), (-1, 1), (1, -1), (1, 1),
        ):
            neighbor = (cell[0] + offset_x, cell[1] + offset_y)
            if neighbor not in self.free or neighbor in blocked:
                continue
            if offset_x and offset_y:
                sides = ((cell[0] + offset_x, cell[1]), (cell[0], cell[1] + offset_y))
                if any(side not in self.free or side in blocked for side in sides):
                    continue
            yield neighbor, math.sqrt(2.0) if offset_x and offset_y else 1.0

    def _simplify(self, path, blocked):
        """Remove unnecessary intermediate cells while preserving clearance."""
        if len(path) < 3:
            return path
        simplified = [path[0]]
        anchor = 0
        while anchor < len(path) - 1:
            candidate = len(path) - 1
            while candidate > anchor + 1 and not self._line_is_free(
                path[anchor], path[candidate], blocked
            ):
                candidate -= 1
            simplified.append(path[candidate])
            anchor = candidate
        return simplified

    def _line_is_free(self, start, end, blocked):
        """Check whether the rasterized segment between two cells is clear."""
        x0, y0 = start
        x1, y1 = end
        steps = max(abs(x1 - x0), abs(y1 - y0))
        if steps == 0:
            return True
        previous = start
        for step in range(steps + 1):
            ratio = step / steps
            cell = (round(x0 + (x1 - x0) * ratio), round(y0 + (y1 - y0) * ratio))
            if cell not in self.free or cell in blocked:
                return False
            if cell[0] != previous[0] and cell[1] != previous[1]:
                sides = ((cell[0], previous[1]), (previous[0], cell[1]))
                if any(side not in self.free or side in blocked for side in sides):
                    return False
            previous = cell
        return True

    def simplify_weighted(self, path, penalties, blocked):
        """Smooth corners without shortcutting the traffic-aware detour."""
        if len(path) < 3:
            return path
        costs = [0.0]
        for before, after in zip(path, path[1:]):
            costs.append(costs[-1] + math.dist(before, after) * (1 + penalties.get(after, 0.0)))
        simplified, anchor = [path[0]], 0
        while anchor < len(path) - 1:
            candidate = len(path) - 1
            while candidate > anchor + 1:
                start, end = path[anchor], path[candidate]
                if self._line_is_free(start, end, blocked):
                    steps = max(abs(end[0] - start[0]), abs(end[1] - start[1]))
                    previous, cost = start, 0.0
                    for i in range(1, steps + 1):
                        cell = (round(start[0] + (end[0] - start[0]) * i / steps),
                                round(start[1] + (end[1] - start[1]) * i / steps))
                        cost += math.dist(previous, cell) * (1 + penalties.get(cell, 0.0))
                        previous = cell
                    if cost <= (costs[candidate] - costs[anchor]) * 1.01 + 1e-9:
                        break
                candidate -= 1
            simplified.append(path[candidate])
            anchor = candidate
        return simplified


class FleetRoamingPlanner:
    """Share destination coverage and soft route reservations across a fleet.

    Only known, connected free cells are eligible. Reservations are costs,
    rather than obstacles: a shared narrow aisle remains usable. Goals survive
    replans (including localization recovery) until physical arrival.
    """

    def __init__(self, planner, random_source, sector_size=8.0):
        self.planner, self.random = planner, random_source
        self.sector_size = sector_size
        self.sectors = defaultdict(list)
        for cell in sorted(planner.free):
            self.sectors[(planner.component_for[cell], self.sector(cell))].append(cell)
        self.assignments = Counter()
        self.visited = set()
        self.goals, self.routes = {}, {}
        self.completed = Counter()
        self.recent_goals = defaultdict(lambda: deque(maxlen=8))
        self.last_position = {}
        self.history = deque(maxlen=600)
        self.traffic = Counter()

    def sector(self, cell):
        x, y = self.planner.cell_to_world(cell)
        return math.floor(x / self.sector_size), math.floor(y / self.sector_size)

    @staticmethod
    def _traffic_cell(cell):
        return cell[0] // 3, cell[1] // 3

    def observe(self, name, position):
        cell = self.planner.nearest_free(*position, maximum_radius=3)
        if cell is None:
            return
        self.visited.add((self.planner.component_for[cell], self.sector(cell)))
        previous = self.last_position.get(name)
        self.last_position[name] = cell
        bucket = self._traffic_cell(cell)
        if previous is None or bucket != self._traffic_cell(previous):
            if len(self.history) == self.history.maxlen:
                self.traffic[self.history[0]] -= 1
            self.history.append(bucket)
            self.traffic[bucket] += 1
        route = self.routes.get(name, [])
        if route:
            closest = min(range(len(route)), key=lambda i: math.dist(cell, route[i]))
            # A jump invalidates the old reservation; the controller will
            # replan when localization readiness is restored.
            self.routes[name] = route[closest:] if math.dist(cell, route[closest]) < 10 else []

    def finish(self, name, reached=True):
        goal = self.goals.pop(name, None)
        if goal is not None:
            self.recent_goals[name].append(goal)
            if reached:
                self.completed[name] += 1
        self.routes.pop(name, None)

    def choose_goal(self, name, start):
        component = self.planner.component_for[start]
        other_goals = [cell for other, cell in self.goals.items() if other != name]
        recent = list(self.recent_goals[name])
        # Relax spacing only if a small reachable component has no candidates.
        for minimum, separation, history_distance in ((6.0, 3.0, 5.0), (3.0, 1.5, 0.0),
                                                       (self.planner.resolution, 0.0, 0.0)):
            eligible = {}
            for key, cells in self.sectors.items():
                if key[0] != component:
                    continue
                candidates = [cell for cell in cells
                              if math.dist(cell, start) * self.planner.resolution >= minimum
                              and all(math.dist(cell, goal) * self.planner.resolution > separation
                                      for goal in other_goals)
                              and all(math.dist(cell, goal) * self.planner.resolution > history_distance
                                      for goal in recent)]
                if candidates:
                    eligible[key] = candidates
            if eligible:
                least = min(self.assignments[key] for key in eligible)
                keys = [key for key in eligible if self.assignments[key] == least]
                key = self.random.choice(keys)
                goal = self.random.choice(eligible[key])
                self.assignments[key] += 1
                self.goals[name] = goal
                return goal
        return None

    def penalties(self, name):
        penalties = {cell: min(1.5, 0.35 * self.traffic[self._traffic_cell(cell)])
                     for cell in self.planner.free if self.traffic[self._traffic_cell(cell)] > 0}
        # Reserve a lane-width band around other vehicles' remaining routes.
        radius = max(1, math.ceil(0.6 / self.planner.resolution))
        for other, route in self.routes.items():
            if other == name:
                continue
            reserved = {(x + dx, y + dy) for x, y in route
                        for dx in range(-radius, radius + 1)
                        for dy in range(-radius, radius + 1)
                        if dx * dx + dy * dy <= radius * radius}
            for cell in reserved & self.planner.free:
                penalties[cell] = penalties.get(cell, 0.0) + 2.5
        return penalties

    def plan(self, name, position, other_positions=()):
        start = self.planner.nearest_free(*position)
        if start is None:
            return [], None
        goal = self.goals.get(name)
        if goal is not None and self.planner.component_for[goal] != self.planner.component_for[start]:
            # A relocation into another disconnected area needs a new goal.
            self.goals.pop(name)
            self.routes.pop(name, None)
            goal = None
        if goal is None:
            goal = self.choose_goal(name, start)
        if goal is None:
            return [], None
        penalties = self.penalties(name)
        temporary = self.planner.blocked_near(other_positions)
        for blocked in (temporary, set()):
            cells = self.planner.plan_weighted_cells(start, goal, penalties, blocked)
            if not cells:
                continue
            self.routes[name] = cells
            corners = self.planner.simplify_weighted(cells, penalties, blocked)
            return [self.planner.cell_to_world(cell) for cell in corners[1:]], self.planner.cell_to_world(goal)
        self.routes.pop(name, None)
        return [], self.planner.cell_to_world(goal)
