"""
Token Bucket Traffic Shaper for NetAdapt.

Implements the Token Bucket algorithm to regulate packet release rates,
permit controlled traffic bursts, enforce queue limits, and accurately measure
shaping delays in simulated time.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
import math
from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from qos import Packet
    from simulator import NetworkSimulator


@dataclass
class ShaperStats:
    """Statistics collected by the traffic shaper."""

    packets_admitted: int = 0
    packets_released: int = 0
    packets_delayed: int = 0
    packets_dropped: int = 0
    total_shaping_delay: float = 0.0
    max_shaping_delay: float = 0.0

    @property
    def average_shaping_delay(self) -> float:
        if self.packets_released <= 0:
            return 0.0
        return self.total_shaping_delay / self.packets_released

    @property
    def average_delayed_wait_time(self) -> float:
        if self.packets_delayed <= 0:
            return 0.0
        return self.total_shaping_delay / self.packets_delayed

    def reset(self) -> None:
        self.packets_admitted = 0
        self.packets_released = 0
        self.packets_delayed = 0
        self.packets_dropped = 0
        self.total_shaping_delay = 0.0
        self.max_shaping_delay = 0.0

    def as_dict(self) -> Dict[str, float]:
        return {
            "packets_admitted": float(self.packets_admitted),
            "packets_released": float(self.packets_released),
            "packets_delayed": float(self.packets_delayed),
            "packets_dropped": float(self.packets_dropped),
            "average_shaping_delay": self.average_shaping_delay,
            "average_delayed_wait_time": self.average_delayed_wait_time,
            "max_shaping_delay": self.max_shaping_delay,
            "total_shaping_delay": self.total_shaping_delay,
        }


EPSILON: float = 1e-9


class TokenBucketShaper:
    """
    Reusable Token Bucket Traffic Shaper.

    Tokens accumulate continuously over simulation time at `rate` tokens/sec,
    capped at `capacity`.
    In 'packets' mode, 1 token allows 1 packet to pass.
    In 'bytes' mode, 1 token allows 1 byte to pass.
    Packets without enough tokens wait in `queue`. If `max_queue_size` is exceeded,
    incoming packets are dropped.
    """

    def __init__(
        self,
        rate: float = 5.0,
        capacity: float = 10.0,
        max_queue_size: int = 50,
        unit: str = "packets",
        enabled: bool = False,
    ) -> None:
        self.validate_config(rate=rate, capacity=capacity, max_queue_size=max_queue_size, unit=unit)
        self.rate: float = float(rate)
        self.capacity: float = float(capacity)
        self.tokens: float = float(capacity)
        self.max_queue_size: int = int(max_queue_size)
        self.unit: str = str(unit).lower()
        self.enabled: bool = bool(enabled)
        self.last_update_time: float = 0.0
        self.queue: deque = deque()
        self.stats: ShaperStats = ShaperStats()

    @staticmethod
    def validate_config(
        rate: Optional[float] = None,
        capacity: Optional[float] = None,
        max_queue_size: Optional[int] = None,
        unit: Optional[str] = None,
    ) -> None:
        """Validate traffic shaper configuration parameters."""
        if rate is not None:
            try:
                r = float(rate)
            except (ValueError, TypeError) as exc:
                raise ValueError(f"Shaping rate must be a number: {rate}") from exc
            if not math.isfinite(r) or r <= 0:
                raise ValueError(f"Shaping rate must be positive and finite: {rate}")
            if r > 1_000_000.0:
                raise ValueError(f"Shaping rate exceeds maximum supported limit (1,000,000): {rate}")

        if capacity is not None:
            try:
                c = float(capacity)
            except (ValueError, TypeError) as exc:
                raise ValueError(f"Bucket capacity must be a number: {capacity}") from exc
            if not math.isfinite(c) or c <= 0:
                raise ValueError(f"Bucket capacity must be positive and finite: {capacity}")
            if c > 1_000_000.0:
                raise ValueError(f"Bucket capacity exceeds maximum supported limit (1,000,000): {capacity}")

        if max_queue_size is not None:
            try:
                q = int(max_queue_size)
            except (ValueError, TypeError) as exc:
                raise ValueError(f"Max queue size must be an integer: {max_queue_size}") from exc
            if q < 0:
                raise ValueError(f"Max queue size cannot be negative: {max_queue_size}")
            if q > 100_000:
                raise ValueError(f"Max queue size exceeds maximum limit (100,000): {max_queue_size}")

        if unit is not None:
            u = str(unit).lower().strip()
            if u not in {"packets", "bytes"}:
                raise ValueError(f"Unsupported unit: {unit}. Must be 'packets' or 'bytes'")

    def configure(
        self,
        rate: Optional[float] = None,
        capacity: Optional[float] = None,
        max_queue_size: Optional[int] = None,
        unit: Optional[str] = None,
        enabled: Optional[bool] = None,
        initial_tokens: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Update shaper parameters with strict validation."""
        self.validate_config(rate=rate, capacity=capacity, max_queue_size=max_queue_size, unit=unit)
        if rate is not None:
            self.rate = float(rate)
        if capacity is not None:
            self.capacity = float(capacity)
            self.tokens = min(self.tokens, self.capacity)
        if max_queue_size is not None:
            self.max_queue_size = int(max_queue_size)
        if unit is not None:
            self.unit = str(unit).lower().strip()
        if initial_tokens is not None:
            it = float(initial_tokens)
            if not math.isfinite(it) or it < 0:
                raise ValueError(f"Initial tokens must be non-negative and finite: {initial_tokens}")
            self.tokens = min(it, self.capacity)
        if enabled is not None:
            self.enabled = bool(enabled)

        return self.to_dict()

    def tokens_needed(self, packet: Any) -> float:
        """Tokens required to transmit a given packet."""
        if self.unit == "bytes":
            return float(getattr(packet, "size", 1000))
        return 1.0

    def update_tokens(self, current_time: float) -> float:
        """
        Accumulate tokens based on elapsed simulation time.
        Fractional tokens are preserved accurately.
        """
        now = float(current_time)
        if now < self.last_update_time:
            # Time went backward (e.g. simulation reset or manual clock set)
            self.last_update_time = now
            return self.tokens

        delta = now - self.last_update_time
        if delta > 0.0:
            accumulated = delta * self.rate
            self.tokens = min(self.capacity, self.tokens + accumulated)
            self.last_update_time = now

        return self.tokens

    def has_waiting_packets(self) -> bool:
        """Check if any packets are waiting in the shaping queue."""
        return len(self.queue) > 0

    def next_release_time(self, current_time: float) -> Optional[float]:
        """
        Calculate the earliest simulation time at which the head of the shaping queue
        can be released.
        """
        if not self.queue:
            return None

        self.update_tokens(current_time)
        head = self.queue[0]
        needed = self.tokens_needed(head)

        deficit = max(0.0, needed - self.tokens)
        token_wait = (deficit / self.rate) if (self.rate > 0 and deficit > EPSILON) else 0.0

        target_time = current_time + token_wait
        creation = getattr(head, "creation_time", current_time)
        return max(target_time, creation)

    def enqueue(self, packet: Any, now: float, simulator: NetworkSimulator) -> bool:
        """
        Submit a packet to the traffic shaper.
        If tokens are immediately available and queue is empty, release immediately.
        Otherwise queue or drop if queue is full.
        """
        from events import EventType

        self.update_tokens(now)
        if self.queue:
            self.release_waiting(now, simulator)

        needed = self.tokens_needed(packet)
        packet.shaper_enqueued_time = now
        self.stats.packets_admitted += 1

        # Check if packet can be released immediately (only if queue is empty)
        if len(self.queue) == 0 and (self.tokens + EPSILON >= needed) and now >= getattr(packet, "creation_time", now):
            self.tokens = max(0.0, self.tokens - needed)
            packet.shaping_delay = 0.0
            self.stats.packets_released += 1
            simulator.scheduler.push(packet, now=now)
            simulator._log_event(
                EventType.SHAPER_PACKET_RELEASED,
                f"Packet {packet.packet_id} released immediately by shaper (tokens remaining: {self.tokens:.2f})",
                packet_id=packet.packet_id,
                source=packet.source,
                destination=packet.destination,
                shaping_delay=0.0,
                tokens=self.tokens,
            )
            return True

        # Cannot be released immediately: check queue limit
        if self.max_queue_size > 0 and len(self.queue) >= self.max_queue_size:
            self.stats.packets_dropped += 1
            packet.delivery_status = "DROPPED"
            flow_id = getattr(packet, "flow_id", None)
            simulator.metrics.record(
                packet.packet_id,
                packet.creation_time,
                None,
                None,
                packet.size,
                "DROPPED",
                flow_id=flow_id,
                route=None,
                traffic_type=packet.traffic_type,
                queue_wait=0.0,
            )
            # Find flow if active and update
            for f in simulator.active_flows.values():
                if packet.packet_id in f.packet_ids:
                    f.packets_dropped += 1
                    break

            simulator._log_event(
                EventType.SHAPER_PACKET_DROPPED,
                f"Packet {packet.packet_id} dropped by traffic shaper: queue limit ({self.max_queue_size}) exceeded",
                packet_id=packet.packet_id,
                source=packet.source,
                destination=packet.destination,
                reason="SHAPER_QUEUE_OVERFLOW",
                queue_length=len(self.queue),
            )
            return False

        # Queue the packet
        self.queue.append(packet)
        simulator._log_event(
            EventType.SHAPER_PACKET_QUEUED,
            f"Packet {packet.packet_id} queued in traffic shaper (queue length: {len(self.queue)}, tokens: {self.tokens:.2f})",
            packet_id=packet.packet_id,
            source=packet.source,
            destination=packet.destination,
            queue_length=len(self.queue),
            tokens=self.tokens,
        )
        return True

    def release_waiting(self, current_time: float, simulator: NetworkSimulator) -> List[Any]:
        """
        Release all waiting packets that can now be served based on accumulated tokens
        and packet creation times.
        """
        from events import EventType

        self.update_tokens(current_time)
        released: List[Any] = []

        while self.queue:
            head = self.queue[0]
            # Must not release ahead of simulated packet creation
            if getattr(head, "creation_time", 0.0) > current_time + EPSILON:
                break

            needed = self.tokens_needed(head)
            if self.tokens + EPSILON >= needed:
                pkt = self.queue.popleft()
                self.tokens = max(0.0, self.tokens - needed)
                enq_time = getattr(pkt, "shaper_enqueued_time", None)
                if enq_time is None:
                    enq_time = getattr(pkt, "creation_time", current_time)
                delay = max(0.0, current_time - enq_time)
                pkt.shaping_delay = delay

                self.stats.packets_released += 1
                if delay > 0.0:
                    self.stats.packets_delayed += 1
                self.stats.total_shaping_delay += delay
                self.stats.max_shaping_delay = max(self.stats.max_shaping_delay, delay)

                simulator.scheduler.push(pkt, now=current_time)
                simulator._log_event(
                    EventType.SHAPER_PACKET_RELEASED,
                    f"Packet {pkt.packet_id} released from traffic shaper (delay: {delay * 1000.0:.2f} ms, tokens remaining: {self.tokens:.2f})",
                    packet_id=pkt.packet_id,
                    source=pkt.source,
                    destination=pkt.destination,
                    shaping_delay=delay,
                    tokens=self.tokens,
                )
                released.append(pkt)
            else:
                break

        return released

    def disable(self, simulator: NetworkSimulator) -> List[Any]:
        """
        Disable shaping without silently losing queued packets.
        All waiting packets are safely flushed into the active scheduler.
        """
        from events import EventType

        self.enabled = False
        flushed: List[Any] = []
        now = simulator.time

        while self.queue:
            pkt = self.queue.popleft()
            enq_time = getattr(pkt, "shaper_enqueued_time", None)
            if enq_time is None:
                enq_time = getattr(pkt, "creation_time", now)
            delay = max(0.0, now - enq_time)
            pkt.shaping_delay = delay

            self.stats.packets_released += 1
            if delay > 0.0:
                self.stats.packets_delayed += 1
            self.stats.total_shaping_delay += delay
            self.stats.max_shaping_delay = max(self.stats.max_shaping_delay, delay)

            simulator.scheduler.push(pkt, now=now)
            simulator._log_event(
                EventType.SHAPER_PACKET_RELEASED,
                f"Packet {pkt.packet_id} flushed to scheduler upon disabling traffic shaper (delay: {delay * 1000.0:.2f} ms)",
                packet_id=pkt.packet_id,
                source=pkt.source,
                destination=pkt.destination,
                shaping_delay=delay,
            )
            flushed.append(pkt)

        simulator._log_event(
            EventType.SHAPER_DISABLED,
            f"Traffic shaping disabled. {len(flushed)} waiting packet(s) released into QoS pipeline.",
            flushed_count=len(flushed),
        )
        return flushed

    def enable(self, simulator: Optional[NetworkSimulator] = None) -> None:
        """Enable traffic shaping."""
        from events import EventType

        self.enabled = True
        if simulator is not None:
            self.last_update_time = simulator.time
            simulator._log_event(
                EventType.SHAPER_ENABLED,
                f"Traffic shaping enabled (rate={self.rate} {self.unit}/s, capacity={self.capacity} {self.unit})",
                rate=self.rate,
                capacity=self.capacity,
                unit=self.unit,
            )

    def reset(self) -> None:
        """Reset shaper to initial state."""
        self.tokens = self.capacity
        self.queue.clear()
        self.stats.reset()
        self.last_update_time = 0.0

    def status(self) -> str:
        """Current operational status of the shaper."""
        if not self.enabled:
            return "DISABLED"
        if len(self.queue) > 0:
            return "SHAPING"
        if self.tokens >= self.capacity:
            return "IDLE"
        return "ACTIVE"

    def to_dict(self) -> Dict[str, Any]:
        """Serialize shaper state for UI and API clients."""
        return {
            "enabled": self.enabled,
            "rate": self.rate,
            "capacity": self.capacity,
            "tokens": round(self.tokens, 3),
            "max_queue_size": self.max_queue_size,
            "current_queue_length": len(self.queue),
            "unit": self.unit,
            "packets_admitted": self.stats.packets_admitted,
            "packets_released": self.stats.packets_released,
            "packets_delayed": self.stats.packets_delayed,
            "packets_dropped": self.stats.packets_dropped,
            "average_shaping_delay": self.stats.average_shaping_delay,
            "average_delayed_wait_time": self.stats.average_delayed_wait_time,
            "max_shaping_delay": self.stats.max_shaping_delay,
            "total_shaping_delay": self.stats.total_shaping_delay,
            "status": self.status(),
        }
