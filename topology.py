from __future__ import annotations

from dataclasses import dataclass
from typing import Any
import networkx as nx


@dataclass
class Link:
    latency: float = 10.0
    bandwidth: float = 100.0
    packet_loss: float = 0.0
    congestion: float = 0.0
    status: str = "UP"


class NetworkTopology:
    def __init__(self) -> None:
        self.graph = nx.Graph()
        self._build_default_topology()

    def _build_default_topology(self) -> None:
        nodes = [
            ("H1", "host"), ("H2", "host"),
            ("H3", "host"), ("H4", "host"),
            ("R1", "router"), ("R2", "router"),
            ("R3", "router"), ("R4", "router"),
            ("R5", "router"), ("R6", "router"),
        ]

        for node, node_type in nodes:
            self.add_node(node, node_type)

        links = [
            ("H1", "R1", 5, 100),
            ("H2", "R2", 5, 100),
            ("H3", "R5", 5, 100),
            ("H4", "R6", 5, 100),

            ("R1", "R2", 10, 100),
            ("R1", "R3", 15, 80),
            ("R2", "R4", 12, 100),
            ("R3", "R4", 8, 100),
            ("R3", "R5", 15, 80),
            ("R4", "R5", 10, 100),
            ("R4", "R6", 18, 80),
            ("R5", "R6", 10, 100),
        ]

        for u, v, latency, bandwidth in links:
            self.add_link(u, v, latency, bandwidth)

    def add_node(self, node: str, node_type: str = "router") -> None:
        self.graph.add_node(
            node,
            type=node_type,
            status="UP",
        )

    def remove_node(self, node: str) -> None:
        if node in self.graph:
            self.graph.remove_node(node)

    def add_link(
        self,
        u: str,
        v: str,
        latency: float = 10.0,
        bandwidth: float = 100.0,
        packet_loss: float = 0.0,
        congestion: float = 0.0,
    ) -> None:
        self.graph.add_edge(
            u,
            v,
            latency=float(latency),
            bandwidth=float(bandwidth),
            packet_loss=float(packet_loss),
            congestion=float(congestion),
            status="UP",
        )

    def remove_link(self, u: str, v: str) -> None:
        if self.graph.has_edge(u, v):
            self.graph.remove_edge(u, v)

    def fail_node(self, node: str) -> None:
        if node in self.graph:
            self.graph.nodes[node]["status"] = "DOWN"

    def recover_node(self, node: str) -> None:
        if node in self.graph:
            self.graph.nodes[node]["status"] = "UP"

    def fail_link(self, u: str, v: str) -> None:
        if self.graph.has_edge(u, v):
            self.graph[u][v]["status"] = "DOWN"

    def recover_link(self, u: str, v: str) -> None:
        if self.graph.has_edge(u, v):
            self.graph[u][v]["status"] = "UP"

    def update_link(self, u: str, v: str, **values: float) -> None:
        if not self.graph.has_edge(u, v):
            raise ValueError(f"Link {u}-{v} does not exist.")

        allowed = {"latency", "bandwidth", "packet_loss", "congestion"}

        for key, value in values.items():
            if key in allowed:
                self.graph[u][v][key] = float(value)

    def set_congestion(self, u: str, v: str, value: float) -> None:
        self.update_link(u, v, congestion=max(0.0, min(1.0, value)))

    def set_packet_loss(self, u: str, v: str, value: float) -> None:
        self.update_link(u, v, packet_loss=max(0.0, min(1.0, value)))

    def active_node(self, node: str) -> bool:
        return (
            node in self.graph
            and self.graph.nodes[node].get("status") == "UP"
        )

    def active_link(self, u: str, v: str) -> bool:
        return (
            self.graph.has_edge(u, v)
            and self.active_node(u)
            and self.active_node(v)
            and self.graph[u][v].get("status") == "UP"
        )

    def active_graph(self) -> nx.Graph:
        g = nx.Graph()

        for node, data in self.graph.nodes(data=True):
            if data.get("status") == "UP":
                g.add_node(node, **data)

        for u, v, data in self.graph.edges(data=True):
            if self.active_link(u, v):
                g.add_edge(u, v, **data)

        return g

    def reset(self) -> None:
        for _, data in self.graph.nodes(data=True):
            data["status"] = "UP"

        for _, _, data in self.graph.edges(data=True):
            data["status"] = "UP"
            data["packet_loss"] = 0.0
            data["congestion"] = 0.0

    def nodes(self) -> list[str]:
        return list(self.graph.nodes)

    def links(self) -> list[tuple[str, str]]:
        return list(self.graph.edges)

    def summary(self) -> dict[str, Any]:
        return {
            "nodes": self.graph.number_of_nodes(),
            "links": self.graph.number_of_edges(),
            "active_nodes": sum(self.active_node(n) for n in self.graph.nodes),
            "active_links": sum(
                self.active_link(u, v) for u, v in self.graph.edges
            ),
        }