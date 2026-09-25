from __future__ import annotations

import random
from typing import Iterable

from topology import NetworkTopology
from routing import AdaptiveRouter
from qos import Packet, create_scheduler, PRIORITIES
from metrics import Metrics


class NetworkSimulator:
    def __init__(
        self,
        topology: NetworkTopology | None = None,
        router: AdaptiveRouter | None = None,
        scheduler: str = "priority",
        seed: int = 42,
    ) -> None:
        self.topology = topology or NetworkTopology()
        self.router = router or AdaptiveRouter()
        self.scheduler_name = scheduler
        self.scheduler = create_scheduler(scheduler)

        self.rng = random.Random(seed)
        self.seed = seed

        self.time = 0.0
        self.next_packet_id = 1
        self.metrics = Metrics()
        self.events: list[dict] = []
        self.packets: list[Packet] = []

    def log(self, event: str, **data) -> None:
        self.events.append(
            {
                "time": round(self.time, 4),
                "event": event,
                **data,
            }
        )

    def generate_packet(
        self,
        source: str,
        destination: str,
        traffic_type: str = "HTTP",
        size: int = 1000,
    ) -> Packet:
        if source == destination:
            raise ValueError("Source and destination must differ.")

        if not self.topology.active_node(source):
            raise ValueError(f"Source {source} is unavailable.")

        if not self.topology.active_node(destination):
            raise ValueError(f"Destination {destination} is unavailable.")

        if traffic_type not in PRIORITIES:
            raise ValueError(f"Unknown traffic type: {traffic_type}")

        packet = Packet(
            packet_id=self.next_packet_id,
            source=source,
            destination=destination,
            traffic_type=traffic_type,
            size=size,
            creation_time=self.time,
        )

        self.next_packet_id += 1
        self.packets.append(packet)
        self.scheduler.push(packet)

        self.log(
            "PACKET_GENERATED",
            packet_id=packet.packet_id,
            source=source,
            destination=destination,
            traffic_type=traffic_type,
        )

        return packet

    def generate_traffic(
        self,
        source: str,
        destination: str,
        count: int = 10,
        traffic_type: str = "HTTP",
        size: int = 1000,
    ) -> list[Packet]:
        return [
            self.generate_packet(
                source,
                destination,
                traffic_type,
                size,
            )
            for _ in range(count)
        ]

    def _transmission_time(self, path: list[str], packet: Packet) -> float:
        total_latency = 0.0

        for u, v in zip(path, path[1:]):
            edge = self.topology.graph[u][v]

            bandwidth = max(edge["bandwidth"], 0.001)
            serialization = packet.size / (bandwidth * 125000)

            total_latency += edge["latency"] / 1000.0
            total_latency += serialization

        return total_latency

    def _packet_loss_probability(self, path: list[str]) -> float:
        probability_no_loss = 1.0

        for u, v in zip(path, path[1:]):
            edge = self.topology.graph[u][v]
            probability_no_loss *= 1.0 - max(
                0.0,
                min(1.0, edge["packet_loss"]),
            )

        return 1.0 - probability_no_loss

    def process_next_packet(self) -> Packet | None:
        if self.scheduler.empty():
            return None

        packet = self.scheduler.pop()

        try:
            path, route_cost = self.router.shortest_path(
                self.topology,
                packet.source,
                packet.destination,
            )
        except ValueError:
            packet.delivery_status = "DROPPED"

            self.metrics.record(
                packet.packet_id,
                packet.creation_time,
                None,
                None,
                packet.size,
                "DROPPED",
            )

            self.log(
                "PACKET_DROPPED",
                packet_id=packet.packet_id,
                reason="NO_ROUTE",
            )

            self.time += 0.001
            return packet

        packet.route = path
        latency = self._transmission_time(path, packet)

        loss_probability = self._packet_loss_probability(path)

        self.time += latency

        if self.rng.random() < loss_probability:
            packet.delivery_status = "DROPPED"

            self.metrics.record(
                packet.packet_id,
                packet.creation_time,
                None,
                None,
                packet.size,
                "DROPPED",
            )

            self.log(
                "PACKET_DROPPED",
                packet_id=packet.packet_id,
                reason="PACKET_LOSS",
                route=path,
            )
        else:
            packet.delivery_status = "DELIVERED"
            packet.delivery_time = self.time
            packet.latency = self.time - packet.creation_time

            self.metrics.record(
                packet.packet_id,
                packet.creation_time,
                packet.delivery_time,
                packet.latency,
                packet.size,
                "DELIVERED",
            )

            self.log(
                "PACKET_DELIVERED",
                packet_id=packet.packet_id,
                route=path,
                route_cost=route_cost,
                latency=packet.latency,
            )

        return packet

    def run(self, steps: int | None = None) -> list[Packet]:
        processed = []

        limit = steps if steps is not None else len(self.scheduler)

        for _ in range(limit):
            packet = self.process_next_packet()

            if packet is None:
                break

            processed.append(packet)

        congestion = self.average_congestion()

        self.metrics.snapshot(
            current_time=self.time,
            congestion=congestion,
        )

        return processed

    def average_congestion(self) -> float:
        edges = list(self.topology.graph.edges(data=True))

        if not edges:
            return 0.0

        return sum(
            data.get("congestion", 0.0)
            for _, _, data in edges
        ) / len(edges)

    def fail_link(self, u: str, v: str) -> None:
        self.topology.fail_link(u, v)
        self.log("LINK_FAILED", link=f"{u}-{v}")

    def recover_link(self, u: str, v: str) -> None:
        self.topology.recover_link(u, v)
        self.log("LINK_RECOVERED", link=f"{u}-{v}")

    def fail_node(self, node: str) -> None:
        self.topology.fail_node(node)
        self.log("NODE_FAILED", node=node)

    def recover_node(self, node: str) -> None:
        self.topology.recover_node(node)
        self.log("NODE_RECOVERED", node=node)

    def set_link_conditions(
        self,
        u: str,
        v: str,
        *,
        latency: float | None = None,
        bandwidth: float | None = None,
        packet_loss: float | None = None,
        congestion: float | None = None,
    ) -> None:
        values = {
            k: v
            for k, v in {
                "latency": latency,
                "bandwidth": bandwidth,
                "packet_loss": packet_loss,
                "congestion": congestion,
            }.items()
            if v is not None
        }

        self.topology.update_link(u, v, **values)

        self.log(
            "LINK_UPDATED",
            link=f"{u}-{v}",
            conditions=values,
        )

    def metrics_snapshot(self) -> dict:
        return self.metrics.snapshot(
            self.time,
            self.average_congestion(),
        )

    def reset(self) -> None:
        self.topology.reset()
        self.scheduler = create_scheduler(self.scheduler_name)
        self.metrics.reset()

        self.time = 0.0
        self.next_packet_id = 1
        self.packets.clear()
        self.events.clear()

        self.log("SIMULATION_RESET")