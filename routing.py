from __future__ import annotations

import heapq
from math import inf
from topology import NetworkTopology


class AdaptiveRouter:
    def __init__(
        self,
        latency_weight: float = 1.0,
        loss_weight: float = 20.0,
        congestion_weight: float = 20.0,
        bandwidth_weight: float = 5.0,
        hop_weight: float = 2.0,
    ) -> None:
        self.weights = {
            "latency": latency_weight,
            "loss": loss_weight,
            "congestion": congestion_weight,
            "bandwidth": bandwidth_weight,
            "hop": hop_weight,
        }

    def _cost(self, data: dict) -> float:
        latency = max(0.0, data["latency"])
        loss = max(0.0, min(1.0, data["packet_loss"]))
        congestion = max(0.0, min(1.0, data["congestion"]))
        bandwidth = max(0.001, data["bandwidth"])

        bandwidth_cost = 100.0 / bandwidth

        return (
            self.weights["latency"] * latency
            + self.weights["loss"] * loss * 100
            + self.weights["congestion"] * congestion * 100
            + self.weights["bandwidth"] * bandwidth_cost
            + self.weights["hop"]
        )

    def shortest_path(
        self,
        topology: NetworkTopology,
        source: str,
        destination: str,
    ) -> tuple[list[str], float]:
        graph = topology.active_graph()

        if source not in graph or destination not in graph:
            raise ValueError("Source or destination is unavailable.")

        distances = {node: inf for node in graph}
        previous: dict[str, str | None] = {node: None for node in graph}
        distances[source] = 0.0

        queue = [(0.0, source)]

        while queue:
            distance, current = heapq.heappop(queue)

            if distance > distances[current]:
                continue

            if current == destination:
                break

            for neighbor in graph.neighbors(current):
                edge = graph[current][neighbor]
                new_distance = distance + self._cost(edge)

                if new_distance < distances[neighbor]:
                    distances[neighbor] = new_distance
                    previous[neighbor] = current
                    heapq.heappush(queue, (new_distance, neighbor))

        if distances[destination] == inf:
            raise ValueError(
                f"No active route from {source} to {destination}."
            )

        path = []
        current: str | None = destination

        while current is not None:
            path.append(current)
            current = previous[current]

        path.reverse()
        return path, distances[destination]

    def route(
        self,
        topology: NetworkTopology,
        source: str,
        destination: str,
    ) -> list[str]:
        return self.shortest_path(topology, source, destination)[0]

    def route_cost(
        self,
        topology: NetworkTopology,
        path: list[str],
    ) -> float:
        if len(path) < 2:
            return 0.0

        total = 0.0

        for u, v in zip(path, path[1:]):
            if not topology.active_link(u, v):
                return inf
            total += self._cost(topology.graph[u][v])

        return total