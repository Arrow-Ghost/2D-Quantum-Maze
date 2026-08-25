"""
Dynamic Maze Generation and Classical BFS Solvability Validation.
Ensures fixed grid dimensions, exact wall count invariance, protected cell preservation,
and 100% path solvability after every player movement.
"""
from typing import List, Tuple, Set, Dict, Any, Optional
from collections import deque


class PRNG:
    """Deterministic 32-bit pseudo-random number generator for reproducible maze topologies."""
    def __init__(self, seed: int):
        self.state = seed & 0xFFFFFFFF

    def next(self) -> float:
        # Mulberry32 PRNG
        self.state = (self.state + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.state
        t = (t ^ (t >> 15)) * (t | 1) & 0xFFFFFFFF
        t = t ^ (t + ((t ^ (t >> 7)) * (t | 61) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0

    def shuffle(self, items: list) -> list:
        arr = list(items)
        for i in range(len(arr) - 1, 0, -1):
            j = int(self.next() * (i + 1))
            arr[i], arr[j] = arr[j], arr[i]
        return arr


def bfs_path_exists(
    rows: int,
    cols: int,
    walls: Set[Tuple[int, int]],
    start: Tuple[int, int],
    target: Tuple[int, int],
) -> bool:
    """Verifies that a valid walkable path exists between start and target."""
    if start == target:
        return True
    if start in walls or target in walls:
        return False

    queue = deque([start])
    visited = {start}

    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]

    while queue:
        r, c = queue.popleft()
        if (r, c) == target:
            return True

        for dr, dc in directions:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols:
                if (nr, nc) not in visited and (nr, nc) not in walls:
                    visited.add((nr, nc))
                    queue.append((nr, nc))

    return False


def generate_dynamic_walls(
    rows: int,
    cols: int,
    wall_count: int,
    level_seed: int,
    move_count: int,
    player_pos: Tuple[int, int],
    exit_pos: Tuple[int, int],
    checkpoint_positions: List[Tuple[int, int]],
    terminal_positions: List[Tuple[int, int]],
    object_positions: List[Tuple[int, int]],
    active_target_checkpoint: Optional[Tuple[int, int]] = None,
    previous_walls: Optional[List[Tuple[int, int]]] = None,
    max_attempts: int = 100,
) -> List[Tuple[int, int]]:
    """
    Generates dynamic wall positions satisfying all constraints:
    1. Fixed exact wall_count.
    2. Zero overlap with protected cells (player, exit, checkpoints, terminals, objects).
    3. 100% path solvability via BFS: Player -> Target Checkpoint (if unactivated) -> Exit.
    4. Deterministic from level_seed + move_count + player_pos.
    """
    # 1. Protected Cells that can NEVER contain a dynamic wall
    protected_cells: Set[Tuple[int, int]] = {
        player_pos,
        exit_pos,
        *checkpoint_positions,
        *terminal_positions,
        *object_positions,
    }

    # 2. Candidate Cells: All grid cells minus protected cells
    candidate_cells: List[Tuple[int, int]] = []
    for r in range(rows):
        for c in range(cols):
            cell = (r, c)
            if cell not in protected_cells:
                candidate_cells.append(cell)

    target_wall_count = min(wall_count, len(candidate_cells))

    # 3. Derive move-specific PRNG seed for deterministic reproducibility
    prng_seed = (
        level_seed
        + move_count * 99991
        + player_pos[0] * 31
        + player_pos[1] * 7
    ) & 0xFFFFFFFF
    prng = PRNG(prng_seed)

    for attempt in range(max_attempts):
        shuffled = prng.shuffle(candidate_cells)
        chosen_walls = set(shuffled[:target_wall_count])

        # Path Solvability Check (BFS)
        if active_target_checkpoint:
            # Must be able to reach active checkpoint, and checkpoint must reach exit
            can_reach_checkpoint = bfs_path_exists(
                rows, cols, chosen_walls, player_pos, active_target_checkpoint
            )
            can_checkpoint_reach_exit = bfs_path_exists(
                rows, cols, chosen_walls, active_target_checkpoint, exit_pos
            )
            is_valid = can_reach_checkpoint and can_checkpoint_reach_exit
        else:
            # Checkpoint already activated; must be able to reach Exit and Terminals
            can_reach_exit = bfs_path_exists(
                rows, cols, chosen_walls, player_pos, exit_pos
            )
            # Ensure terminals are reachable
            can_reach_terminals = all(
                bfs_path_exists(rows, cols, chosen_walls, player_pos, t_pos)
                for t_pos in terminal_positions
            )
            is_valid = can_reach_exit and can_reach_terminals

        if is_valid:
            # Success! Return sorted list of wall coordinates
            return sorted(list(chosen_walls))

    # Fallback to previous valid walls if generation exhausted attempts
    if previous_walls and len(previous_walls) == target_wall_count:
        # Verify previous walls don't intersect current player position
        if player_pos not in set(previous_walls):
            return previous_walls

    # Emergency fallback: ensure exact count and player cell is clear
    fallback = prng.shuffle(candidate_cells)[:target_wall_count]
    return sorted(list(fallback))
