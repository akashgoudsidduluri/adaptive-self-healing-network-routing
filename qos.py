from __future__ import annotations

from dataclasses import dataclass, field
from collections import deque
import heapq


PRIORITIES = {
    "Emergency": 5,
    "VoIP": 4,
    "Video": 3,
    "HTTP": 2,
    "FTP": 1,
}


@dataclass
class Packet:
    packet_id: int
    source: str
    destination: str
    traffic_type: str = "HTTP"
    size: int = 1000
    creation_time: float = 0.0
    priority: int = field(init=False)
    route: list[str] = field(default_factory=list)
    delivery_status: str = "PENDING"
    delivery_time: float | None = None
    latency: float | None = None

    def __post_init__(self) -> None:
        if self.traffic_type not in PRIORITIES:
            raise ValueError(f"Unknown traffic type: {self.traffic_type}")
        self.priority = PRIORITIES[self.traffic_type]


class FIFOQueue:
    def __init__(self) -> None:
        self._queue = deque()

    def push(self, packet: Packet) -> None:
        self._queue.append(packet)

    def pop(self) -> Packet:
        return self._queue.popleft()

    def empty(self) -> bool:
        return not self._queue

    def __len__(self) -> int:
        return len(self._queue)


class PriorityQueue:
    def __init__(self) -> None:
        self._queue = []
        self._counter = 0

    def push(self, packet: Packet) -> None:
        heapq.heappush(
            self._queue,
            (-packet.priority, self._counter, packet),
        )
        self._counter += 1

    def pop(self) -> Packet:
        return heapq.heappop(self._queue)[2]

    def empty(self) -> bool:
        return not self._queue

    def __len__(self) -> int:
        return len(self._queue)


class WFQ:
    """
    Basic weighted fair queue.

    Higher-priority traffic receives proportionally higher service weight.
    This provides the extensible Stage-1 foundation for the full QoS phase.
    """

    def __init__(self) -> None:
        self.queues = {name: deque() for name in PRIORITIES}
        self.weights = PRIORITIES.copy()
        self._credits = self.weights.copy()

    def push(self, packet: Packet) -> None:
        self.queues[packet.traffic_type].append(packet)

    def pop(self) -> Packet:
        available = [
            name for name, queue in self.queues.items() if queue
        ]

        if not available:
            raise IndexError("WFQ is empty.")

        selected = max(
            available,
            key=lambda name: self._credits[name],
        )

        packet = self.queues[selected].popleft()

        for name in available:
            self._credits[name] += self.weights[name]

        self._credits[selected] -= sum(self.weights.values())

        return packet

    def empty(self) -> bool:
        return all(not q for q in self.queues.values())

    def __len__(self) -> int:
        return sum(len(q) for q in self.queues.values())


def create_scheduler(name: str):
    name = name.lower().replace(" ", "_")

    if name == "fifo":
        return FIFOQueue()

    if name in {"priority", "priority_queue"}:
        return PriorityQueue()

    if name == "wfq":
        return WFQ()

    raise ValueError(f"Unknown scheduler: {name}")