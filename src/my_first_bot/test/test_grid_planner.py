import random
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))

from grid_planner import OccupancyGridPlanner  # noqa: E402


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
