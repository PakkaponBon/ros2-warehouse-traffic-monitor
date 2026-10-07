import random
import sys
from pathlib import Path

from PIL import Image
import yaml


sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))

from grid_planner import FleetRoamingPlanner, OccupancyGridPlanner  # noqa: E402


def planner(free_cells, width=10, height=10):
    return OccupancyGridPlanner(1.0, (0.0, 0.0), width, height, free_cells)


def test_astar_routes_through_the_only_wall_gap():
    free = {
        (x, y)
        for x in range(10)
        for y in range(10)
        if x != 5 or y == 7
    }
    route = planner(free).plan_cells((1, 1), (8, 1))
    assert route[0] == (1, 1)
    assert route[-1] == (8, 1)
    assert (5, 7) in route


def test_astar_does_not_cut_diagonally_between_obstacles():
    free = {(0, 0), (1, 1)}
    assert planner(free, 2, 2).plan_cells((0, 0), (1, 1)) == []


def test_dynamic_vehicle_cells_can_block_a_route():
    free = {(x, 0) for x in range(6)}
    grid = planner(free, 6, 1)
    blocked = grid.blocked_near([(2.5, 0.5)], radius=0.1)
    assert grid.plan_cells((0, 0), (5, 0), blocked) == []


def test_weighted_route_avoids_busy_cells_when_an_alternative_exists():
    free = {(x, y) for x in range(7) for y in range(3)}
    grid = planner(free, 7, 3)
    busy = {(x, 1): 10.0 for x in range(2, 5)}

    shortest = grid.plan_cells((0, 1), (6, 1))
    suggested = grid.plan_weighted_cells((0, 1), (6, 1), busy)

    assert all((x, 1) in shortest for x in range(2, 5))
    assert not any(cell in busy for cell in suggested)


def test_weighted_route_still_uses_busy_cell_when_it_is_the_only_path():
    free = {(x, 0) for x in range(6)}
    grid = planner(free, 6, 1)

    route = grid.plan_weighted_cells((0, 0), (5, 0), {(3, 0): 100.0})

    assert route[0] == (0, 0)
    assert route[-1] == (5, 0)
    assert (3, 0) in route


def test_random_path_chooses_a_distant_reachable_goal():
    free = {(x, y) for x in range(12) for y in range(12)}
    path, goal = planner(free, 12, 12).random_path(
        (0.5, 0.5), random.Random(5), minimum_distance=6.0
    )
    assert path
    assert goal == path[-1]
    assert goal[0] > 0.5 or goal[1] > 0.5


def test_random_path_falls_back_when_vehicle_temporarily_splits_aisle():
    free = {(x, 0) for x in range(12)}
    path, goal = planner(free, 12, 1).random_path(
        (0.5, 0.5),
        random.Random(7),
        dynamic_points=[(4.5, 0.5)],
        minimum_distance=6.0,
    )
    assert path
    assert goal == path[-1]


def test_fixed_goal_path_falls_back_when_vehicle_temporarily_splits_aisle():
    free = {(x, 0) for x in range(12)}
    path, goal = planner(free, 12, 1).path_to_goal(
        (0.5, 0.5),
        (10.5, 0.5),
        dynamic_points=[(4.5, 0.5)],
    )
    assert path
    assert goal == (10.5, 0.5)
    assert goal == path[-1]


def test_saved_trinary_unknown_cells_are_not_traversable(tmp_path):
    image = Image.new("L", (9, 9), 254)
    image.putpixel((4, 4), 205)
    image.save(tmp_path / "map.pgm")
    (tmp_path / "map.yaml").write_text(yaml.safe_dump({
        "image": "map.pgm", "resolution": 1.0, "origin": [0.0, 0.0, 0.0],
        "mode": "trinary", "free_thresh": 0.25,
    }))
    grid = OccupancyGridPlanner.from_yaml(
        tmp_path / "map.yaml", planning_resolution=1.0, robot_radius=0.1)
    assert (4, 4) not in grid.free
    assert (4, 3) not in grid.free  # inflated robot footprint
    assert (0, 0) in grid.free


def test_roaming_fleet_spreads_goals_and_covers_all_reachable_sectors():
    grid = planner({(x, y) for x in range(32) for y in range(32)}, 32, 32)
    fleet = FleetRoamingPlanner(grid, random.Random(42))
    positions = {str(i): (float(i) + 0.5, 0.5) for i in range(8)}
    for name, position in positions.items():
        path, goal = fleet.plan(name, position)
        assert path and goal == path[-1]
    import math
    goals = list(fleet.goals.values())
    assert all(math.dist(a, b) >= 3 for i, a in enumerate(goals) for b in goals[i+1:])
    for _ in range(8):
        for name in positions:
            goal = grid.cell_to_world(fleet.goals[name])
            fleet.observe(name, goal)
            fleet.finish(name)
            path, next_goal = fleet.plan(name, goal)
            assert path and math.dist(goal, next_goal) >= 6
    assert len(fleet.visited) == len(fleet.sectors)
    assert all(fleet.completed[name] == 8 for name in positions)


def test_roaming_replan_preserves_goal_after_jump_in_connected_map():
    grid = planner({(x, y) for x in range(24) for y in range(24)}, 24, 24)
    fleet = FleetRoamingPlanner(grid, random.Random(4))
    _, original = fleet.plan('a', (0.5, 0.5))
    fleet.observe('a', (23.5, 23.5))
    path, corrected = fleet.plan('a', (23.5, 23.5))
    assert corrected == original
    assert path[-1] == original
    assert fleet.completed['a'] == 0


def test_roaming_changes_goal_when_jump_crosses_disconnected_components():
    grid = planner({(x, 0) for x in range(10)} | {(x, 0) for x in range(20, 30)}, 30, 1)
    fleet = FleetRoamingPlanner(grid, random.Random(3))
    _, original = fleet.plan('a', (0.5, 0.5))
    path, corrected = fleet.plan('a', (20.5, 0.5))
    assert path and corrected[0] > 20 and original[0] < 10
    assert fleet.completed['a'] == 0


def test_roaming_uses_shared_aisle_when_no_alternative_exists():
    grid = planner({(x, 0) for x in range(20)}, 20, 1)
    fleet = FleetRoamingPlanner(grid, random.Random(4))
    fleet.routes['b'] = [(x, 0) for x in range(20)]
    path, goal = fleet.plan('a', (0.5, 0.5), [(4.5, 0.5)])
    assert path and goal == path[-1]


def test_smoothing_does_not_erase_reserved_route_detour():
    grid = planner({(x, y) for x in range(12) for y in range(5)}, 12, 5)
    penalties = {(x, 2): 10 for x in range(2, 10)}
    path = grid.plan_weighted_cells((0, 2), (11, 2), penalties)
    smooth = grid.simplify_weighted(path, penalties, set())
    assert len(smooth) > 2
    assert any(y != 2 for x, y in smooth)
    # Reconstruct each straight segment to check the detour after smoothing.
    for a, b in zip(smooth, smooth[1:]):
        steps = max(abs(a[0]-b[0]), abs(a[1]-b[1]))
        assert all((round(a[0]+(b[0]-a[0])*i/steps), round(a[1]+(b[1]-a[1])*i/steps))
                   not in penalties for i in range(steps+1))


def test_route_smoothing_does_not_cut_obstacle_corner():
    grid = planner({(0, 0), (1, 1)}, 2, 2)
    assert not grid._line_is_free((0, 0), (1, 1), set())
