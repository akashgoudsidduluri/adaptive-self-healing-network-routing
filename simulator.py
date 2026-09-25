from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from topology import NetworkTopology
from routing import AdaptiveRouter
from qos import Packet, create_scheduler, PRIORITIES
from metrics import Metrics, RecoveryRecord
from events import EventLogger, EventType


@dataclass
class TrafficFlow:
    """Represents an active traffic flow between two endpoints."""

    flow_id: str
    source: str
    destination: str
    traffic_type: str = "HTTP"
    packet_count: int = 10
    packet_size: int = 1000
    pps: float = 10.0  # packets per second
    duration: float = 5.0  # seconds
    start_time: float = 0.0
    end_time: float | None = None
    status: str = "ACTIVE"  # ACTIVE, COMPLETED, FAILED, PENDING
    current_route: List[str] = field(default_factory=list)
    route_cost: float = 0.0
    route_status: str = "HEALTHY"  # HEALTHY, REROUTED, FAILED
    packets_sent: int = 0
    packets_delivered: int = 0
    packets_dropped: int = 0
    packet_ids: List[int] = field(default_factory=list)
    detection_time: float | None = None
    recovery_time: float | None = None
    previous_route: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "flow_id": self.flow_id,
            "source": self.source,
            "destination": self.destination,
            "traffic_type": self.traffic_type,
            "packet_count": self.packet_count,
            "packet_size": self.packet_size,
            "pps": self.pps,
            "duration": self.duration,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "status": self.status,
            "current_route": self.current_route,
            "route_cost": self.route_cost,
            "route_status": self.route_status,
            "packets_sent": self.packets_sent,
            "packets_delivered": self.packets_delivered,
            "packets_dropped": self.packets_dropped,
        }


class NetworkSimulator:
    """
    Central simulation engine for NetAdapt.

    Connects Topology, Routing, QoS, Metrics, Events, and Traffic Flows.
    Implements self-healing behavior with heartbeat-based failure detection.
    """

    def __init__(
        self,
        topology: NetworkTopology | None = None,
        router: AdaptiveRouter | None = None,
        scheduler: str = "priority",
        seed: int = 42,
        heartbeat_interval: float = 1.0,
        failure_detection_timeout: float = 3.0,
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
        self.events: List[Dict[str, Any]] = []  # legacy format for backward compat
        self.packets: List[Packet] = []

        # Enhanced event system
        self.event_logger = EventLogger()

        # Heartbeat / health check simulation
        self.heartbeat_interval = heartbeat_interval
        self.failure_detection_timeout = failure_detection_timeout
        self.last_heartbeat_check = 0.0

        # Failure tracking: component -> failure_time
        self._failed_links: Dict[Tuple[str, str], float] = {}
        self._failed_nodes: Dict[str, float] = {}
        # Detection tracking: component -> detection_time
        self._detected_links: Dict[Tuple[str, str], float] = {}
        self._detected_nodes: Dict[str, float] = {}

        # Traffic flows
        self.active_flows: Dict[str, TrafficFlow] = {}
        self.flow_counter = 1
        self.flow_history: List[TrafficFlow] = []

        # Performance comparison snapshots
        self.baseline_metrics: Optional[Dict[str, float]] = None
        self.during_failure_metrics: Optional[Dict[str, float]] = None
        self.after_recovery_metrics: Optional[Dict[str, float]] = None

    # ------------------------------------------------------------------
    # Logging
    # ------------------------------------------------------------------
    def log(self, event: str, **data) -> None:
        """Legacy log method for backward compatibility."""
        entry = {
            "time": round(self.time, 4),
            "event": event,
            **data,
        }
        self.events.append(entry)

        # Also log to structured logger
        component = data.get("link") or data.get("node") or data.get("component")
        flow_id = data.get("flow_id")
        message = data.get("message") or f"{event} {component or ''}".strip()
        try:
            self.event_logger.log(
                timestamp=self.time,
                event_type=event,
                message=message,
                component=component,
                flow_id=flow_id,
                **{k: v for k, v in data.items() if k not in ("link", "node", "component", "flow_id", "message")},
            )
        except Exception:
            pass

    def _log_event(
        self,
        event_type: str,
        message: str,
        component: Optional[str] = None,
        flow_id: Optional[str] = None,
        **details: Any,
    ) -> None:
        """Structured event logging."""
        self.event_logger.log(
            timestamp=self.time,
            event_type=event_type,
            message=message,
            component=component,
            flow_id=flow_id,
            **details,
        )
        # Legacy mirror
        legacy = {
            "time": round(self.time, 4),
            "event": event_type,
            "message": message,
        }
        if component:
            if "-" in component or "↔" in component:
                legacy["link"] = component
            else:
                legacy["node"] = component
            legacy["component"] = component
        if flow_id:
            legacy["flow_id"] = flow_id
        legacy.update(details)
        self.events.append(legacy)

    # ------------------------------------------------------------------
    # Packet generation (Stage 1 preserved)
    # ------------------------------------------------------------------
    def generate_packet(
        self,
        source: str,
        destination: str,
        traffic_type: str = "HTTP",
        size: int = 1000,
        flow_id: Optional[str] = None,
        creation_time: Optional[float] = None,
    ) -> Packet:
        if source == destination:
            raise ValueError("Source and destination must differ.")

        if not self.topology.active_node(source):
            raise ValueError(f"Source {source} is unavailable.")

        if not self.topology.active_node(destination):
            raise ValueError(f"Destination {destination} is unavailable.")

        if traffic_type not in PRIORITIES:
            raise ValueError(f"Unknown traffic type: {traffic_type}")

        ctime = creation_time if creation_time is not None else self.time

        packet = Packet(
            packet_id=self.next_packet_id,
            source=source,
            destination=destination,
            traffic_type=traffic_type,
            size=size,
            creation_time=ctime,
        )

        self.next_packet_id += 1
        self.packets.append(packet)
        self.scheduler.push(packet)

        self._log_event(
            EventType.PACKET_GENERATED,
            f"Packet {packet.packet_id} generated {source}→{destination} [{traffic_type}]",
            flow_id=flow_id,
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
        pps: float = 10.0,
        flow_id: Optional[str] = None,
    ) -> List[Packet]:
        packets = []
        interval = 1.0 / max(pps, 0.1)
        base_time = self.time
        for i in range(count):
            pkt = self.generate_packet(
                source,
                destination,
                traffic_type,
                size,
                flow_id=flow_id,
                creation_time=base_time + i * interval,
            )
            packets.append(pkt)
        return packets

    # ------------------------------------------------------------------
    # Traffic Flow Management (Stage 2+3)
    # ------------------------------------------------------------------
    def create_flow(
        self,
        source: str,
        destination: str,
        traffic_type: str = "HTTP",
        packet_count: int = 10,
        packet_size: int = 1000,
        pps: float = 10.0,
        duration: float = 5.0,
    ) -> TrafficFlow:
        if source == destination:
            raise ValueError("Source and destination must differ.")
        if not self.topology.active_node(source):
            raise ValueError(f"Source {source} is unavailable.")
        if not self.topology.active_node(destination):
            raise ValueError(f"Destination {destination} is unavailable.")
        if traffic_type not in PRIORITIES:
            raise ValueError(f"Unknown traffic type: {traffic_type}")

        flow_id = f"flow-{self.flow_counter}"
        self.flow_counter += 1

        # Calculate initial route
        try:
            route, cost = self.router.shortest_path(self.topology, source, destination)
            route_status = "HEALTHY"
        except ValueError:
            route = []
            cost = float("inf")
            route_status = "FAILED"

        flow = TrafficFlow(
            flow_id=flow_id,
            source=source,
            destination=destination,
            traffic_type=traffic_type,
            packet_count=packet_count,
            packet_size=packet_size,
            pps=pps,
            duration=duration,
            start_time=self.time,
            current_route=route,
            route_cost=cost,
            route_status=route_status,
            status="ACTIVE" if route else "FAILED",
        )

        self.active_flows[flow_id] = flow
        self.metrics.active_flows_count = len(self.active_flows)

        self._log_event(
            EventType.TRAFFIC_STARTED,
            f"Flow {flow_id} started {source}→{destination} [{traffic_type}] {packet_count} packets",
            component=f"{source}→{destination}",
            flow_id=flow_id,
            source=source,
            destination=destination,
            traffic_type=traffic_type,
            packet_count=packet_count,
            route=route,
            route_cost=cost,
        )

        # Generate packets for this flow
        self._generate_packets_for_flow(flow)

        # Snapshot baseline if first flow
        if len(self.metrics.history) == 0:
            self.metrics.snapshot(self.time, self.average_congestion(), len(self.active_flows))

        return flow

    def _generate_packets_for_flow(self, flow: TrafficFlow) -> List[Packet]:
        """Generate actual Packet objects for a flow."""
        packets = []
        # Determine effective count: if duration specified and pps, count may be derived
        # For this implementation, use packet_count directly, but space them by pps
        count = flow.packet_count
        interval = 1.0 / max(flow.pps, 0.1)
        for i in range(count):
            ctime = flow.start_time + i * interval
            pkt = self.generate_packet(
                flow.source,
                flow.destination,
                flow.traffic_type,
                flow.packet_size,
                flow_id=flow.flow_id,
                creation_time=ctime,
            )
            packets.append(pkt)
            flow.packet_ids.append(pkt.packet_id)

        flow.packets_sent = len(packets)
        return packets

    def get_flow(self, flow_id: str) -> Optional[TrafficFlow]:
        return self.active_flows.get(flow_id)

    def list_flows(self) -> List[TrafficFlow]:
        return list(self.active_flows.values())

    # ------------------------------------------------------------------
    # Transmission modeling
    # ------------------------------------------------------------------
    def _transmission_time(self, path: List[str], packet: Packet) -> float:
        total_latency = 0.0

        for u, v in zip(path, path[1:]):
            if not self.topology.graph.has_edge(u, v):
                continue
            edge = self.topology.graph[u][v]

            bandwidth = max(edge.get("bandwidth", 100.0), 0.001)
            base_latency = edge.get("latency", 10.0)
            congestion = edge.get("congestion", 0.0)

            # Bandwidth affects serialization: size in bytes -> bits
            serialization = packet.size / (bandwidth * 125000)

            # Congestion increases both latency and serialization
            congestion_factor = 1.0 + congestion * 2.0

            total_latency += (base_latency / 1000.0) * congestion_factor
            total_latency += serialization * congestion_factor

        return total_latency

    def _packet_loss_probability(self, path: List[str]) -> float:
        probability_no_loss = 1.0

        for u, v in zip(path, path[1:]):
            if not self.topology.graph.has_edge(u, v):
                continue
            edge = self.topology.graph[u][v]
            loss = max(0.0, min(1.0, edge.get("packet_loss", 0.0)))
            congestion = max(0.0, min(1.0, edge.get("congestion", 0.0)))
            # Congestion contributes to effective loss
            effective_loss = min(1.0, loss + congestion * 0.05)
            probability_no_loss *= 1.0 - effective_loss

        return 1.0 - probability_no_loss

    def _route_uses_link(self, route: List[str], u: str, v: str) -> bool:
        """Check if route uses link u-v in either direction."""
        for a, b in zip(route, route[1:]):
            if (a == u and b == v) or (a == v and b == u):
                return True
        return False

    def _route_uses_node(self, route: List[str], node: str) -> bool:
        return node in route

    # ------------------------------------------------------------------
    # Packet processing
    # ------------------------------------------------------------------
    def process_next_packet(self) -> Packet | None:
        if self.scheduler.empty():
            return None

        packet = self.scheduler.pop()

        # Find flow if associated
        flow = None
        # Search flow by packet_id (could be optimized)
        for f in self.active_flows.values():
            if packet.packet_id in f.packet_ids:
                flow = f
                break

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
                flow_id=flow.flow_id if flow else None,
                route=None,
            )

            if flow:
                flow.packets_dropped += 1
                if flow.packets_dropped + flow.packets_delivered >= flow.packets_sent:
                    flow.status = "FAILED"
                    flow.end_time = self.time

            self._log_event(
                EventType.PACKET_DROPPED,
                f"Packet {packet.packet_id} dropped: no route {packet.source}→{packet.destination}",
                flow_id=flow.flow_id if flow else None,
                packet_id=packet.packet_id,
                reason="NO_ROUTE",
            )

            self.time += 0.001
            # Heartbeat check opportunistically
            self.check_heartbeats()
            return packet

        # Detect route change for flow
        if flow and flow.current_route and flow.current_route != path:
            flow.previous_route = flow.current_route.copy()
            flow.current_route = path
            flow.route_cost = route_cost
            if flow.route_status != "FAILED":
                flow.route_status = "REROUTED"

            self._log_event(
                EventType.ROUTE_RECALCULATED,
                f"Route recalculated for flow {flow.flow_id}: {' → '.join(path)} cost={route_cost:.2f}",
                component=f"{packet.source}→{packet.destination}",
                flow_id=flow.flow_id,
                old_route=flow.previous_route,
                new_route=path,
                route_cost=route_cost,
            )
            self._log_event(
                EventType.TRAFFIC_REROUTED,
                f"Traffic rerouted for flow {flow.flow_id}",
                component=f"{packet.source}→{packet.destination}",
                flow_id=flow.flow_id,
                route=path,
            )
            # Update recovery record recalculation time
            # Find most recent recovery record for components in previous route that are now avoided
            for comp, det_time in list(self._detected_links.items()):
                if self._route_uses_link(flow.previous_route, comp[0], comp[1]) and not self._route_uses_link(path, comp[0], comp[1]):
                    comp_str = f"{comp[0]}-{comp[1]}"
                    self.metrics.update_recovery_recalculation(comp_str, self.time)
        elif flow and not flow.current_route:
            flow.current_route = path
            flow.route_cost = route_cost
            flow.route_status = "HEALTHY"

        packet.route = path
        # Ensure simulation time respects packet creation time (no negative latency)
        if packet.creation_time > self.time:
            self.time = packet.creation_time

        transmission_delay = self._transmission_time(path, packet)

        loss_probability = self._packet_loss_probability(path)

        # Advance simulation clock by transmission time
        self.time += transmission_delay

        # Heartbeat check after time advance
        self.check_heartbeats()

        # For latency calculation, use transmission delay plus any queuing
        latency = transmission_delay

        if self.rng.random() < loss_probability:
            packet.delivery_status = "DROPPED"

            self.metrics.record(
                packet.packet_id,
                packet.creation_time,
                None,
                None,
                packet.size,
                "DROPPED",
                flow_id=flow.flow_id if flow else None,
                route=path,
            )

            if flow:
                flow.packets_dropped += 1

            self._log_event(
                EventType.PACKET_DROPPED,
                f"Packet {packet.packet_id} dropped (loss prob {loss_probability:.2%})",
                flow_id=flow.flow_id if flow else None,
                packet_id=packet.packet_id,
                reason="PACKET_LOSS",
                route=path,
                loss_probability=loss_probability,
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
                flow_id=flow.flow_id if flow else None,
                route=path,
            )

            if flow:
                flow.packets_delivered += 1

            self._log_event(
                EventType.PACKET_DELIVERED,
                f"Packet {packet.packet_id} delivered via {' → '.join(path)} latency={packet.latency*1000:.1f}ms",
                flow_id=flow.flow_id if flow else None,
                packet_id=packet.packet_id,
                route=path,
                route_cost=route_cost,
                latency=packet.latency,
            )

        # Check if flow completed
        if flow:
            if flow.packets_delivered + flow.packets_dropped >= flow.packets_sent:
                if flow.status != "FAILED":
                    flow.status = "COMPLETED"
                flow.end_time = self.time
                self._log_event(
                    EventType.FLOW_COMPLETED if flow.status == "COMPLETED" else EventType.FLOW_FAILED,
                    f"Flow {flow.flow_id} {flow.status.lower()}: delivered {flow.packets_delivered}/{flow.packets_sent}",
                    flow_id=flow.flow_id,
                    packets_delivered=flow.packets_delivered,
                    packets_dropped=flow.packets_dropped,
                )

        return packet

    def run(self, steps: int | None = None) -> List[Packet]:
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
            active_flows=len(self.active_flows),
        )

        return processed

    def run_until_empty(self) -> List[Packet]:
        """Run until scheduler is empty."""
        all_processed = []
        while not self.scheduler.empty():
            pkt = self.process_next_packet()
            if pkt is None:
                break
            all_processed.append(pkt)
        self.metrics.snapshot(self.time, self.average_congestion(), len(self.active_flows))
        return all_processed

    def tick(self, delta: float = 1.0) -> None:
        """Advance simulation time by delta and check heartbeats."""
        self.time += delta
        self.check_heartbeats()
        self.metrics.snapshot(self.time, self.average_congestion(), len(self.active_flows))

    # ------------------------------------------------------------------
    # Heartbeat / Failure Detection
    # ------------------------------------------------------------------
    def check_heartbeats(self) -> List[str]:
        """
        Simulated heartbeat checking.

        Detects failures after failure_detection_timeout.
        Returns list of newly detected components.
        """
        if self.time - self.last_heartbeat_check < self.heartbeat_interval:
            # Still check for timeouts even if interval not elapsed? Requirement says periodic.
            # We'll allow detection check every time, but update last_heartbeat_check periodically.
            pass

        newly_detected = []

        # Check links
        for (u, v), failure_time in list(self._failed_links.items()):
            key = (u, v)
            if key in self._detected_links:
                continue
            elapsed = self.time - failure_time
            if elapsed >= self.failure_detection_timeout:
                self._detected_links[key] = self.time
                comp_str = f"{u}-{v}"
                newly_detected.append(comp_str)

                self.metrics.update_recovery_detection(comp_str, self.time)

                self._log_event(
                    EventType.FAILURE_DETECTED,
                    f"Failure detected on link {u}↔{v} after {elapsed:.2f}s",
                    component=comp_str,
                    failure_time=failure_time,
                    detection_time=self.time,
                    detection_delay=elapsed,
                )

                # Trigger rerouting
                self._recalculate_routes_for_failed_component(comp_str, "LINK", [(u, v)], [])

        # Check nodes
        for node, failure_time in list(self._failed_nodes.items()):
            if node in self._detected_nodes:
                continue
            elapsed = self.time - failure_time
            if elapsed >= self.failure_detection_timeout:
                self._detected_nodes[node] = self.time
                newly_detected.append(node)

                self.metrics.update_recovery_detection(node, self.time)

                self._log_event(
                    EventType.FAILURE_DETECTED,
                    f"Failure detected on node {node} after {elapsed:.2f}s",
                    component=node,
                    failure_time=failure_time,
                    detection_time=self.time,
                    detection_delay=elapsed,
                )

                self._recalculate_routes_for_failed_component(node, "NODE", [], [node])

        self.last_heartbeat_check = self.time
        return newly_detected

    def _recalculate_routes_for_failed_component(
        self,
        component: str,
        component_type: str,
        failed_links: List[Tuple[str, str]],
        failed_nodes: List[str],
    ) -> None:
        """Recalculate routes for flows affected by failure."""
        for flow in self.active_flows.values():
            if flow.status == "FAILED":
                continue

            affected = False
            for u, v in failed_links:
                if self._route_uses_link(flow.current_route, u, v):
                    affected = True
                    break
            for node in failed_nodes:
                if self._route_uses_node(flow.current_route, node):
                    affected = True
                    break

            if not affected:
                continue

            # Try to find alternative route
            try:
                new_route, new_cost = self.router.shortest_path(
                    self.topology, flow.source, flow.destination
                )
                if new_route != flow.current_route:
                    flow.previous_route = flow.current_route.copy()
                    flow.current_route = new_route
                    flow.route_cost = new_cost
                    flow.route_status = "REROUTED"

                    self._log_event(
                        EventType.ROUTE_RECALCULATED,
                        f"Route recalculated for flow {flow.flow_id}: {' → '.join(new_route)}",
                        component=component,
                        flow_id=flow.flow_id,
                        old_route=flow.previous_route,
                        new_route=new_route,
                        route_cost=new_cost,
                    )
                    self._log_event(
                        EventType.TRAFFIC_REROUTED,
                        f"Traffic rerouted for flow {flow.flow_id} via {' → '.join(new_route)}",
                        component=component,
                        flow_id=flow.flow_id,
                        route=new_route,
                    )
                    self.metrics.update_recovery_recalculation(component, self.time)

            except ValueError:
                # No alternative route
                flow.previous_route = flow.current_route.copy()
                flow.current_route = []
                flow.route_status = "FAILED"
                flow.status = "FAILED"
                self._log_event(
                    EventType.FLOW_FAILED,
                    f"Flow {flow.flow_id} failed: no alternative route after {component} failure",
                    component=component,
                    flow_id=flow.flow_id,
                )

    # ------------------------------------------------------------------
    # Failure injection / recovery
    # ------------------------------------------------------------------
    def fail_link(self, u: str, v: str) -> None:
        # Normalize key for tracking
        key = tuple(sorted((u, v)))
        # Check if already failed
        if key in self._failed_links:
            return

        if not self.topology.graph.has_edge(u, v):
            # Try to find edge in either order
            if not self.topology.graph.has_edge(v, u):
                raise ValueError(f"Link {u}-{v} does not exist.")

        self.topology.fail_link(u, v)
        failure_time = self.time
        self._failed_links[key] = failure_time

        # Record recovery tracking
        comp_str = f"{u}-{v}"
        rec = RecoveryRecord(
            failure_time=failure_time,
            component=comp_str,
            component_type="LINK",
        )
        self.metrics.add_recovery_record(rec)

        self._log_event(
            EventType.LINK_FAILED,
            f"Link {u}↔{v} failed at {failure_time:.2f}s",
            component=comp_str,
            failure_time=failure_time,
        )

        # Save baseline snapshot for comparison
        self.metrics.snapshot(self.time, self.average_congestion(), len(self.active_flows))
        self.baseline_metrics = self.metrics.get_latest()

        # Immediate heartbeat check if timeout is 0
        if self.failure_detection_timeout <= 0:
            self.check_heartbeats()
        else:
            # For UI responsiveness, we still want to detect quickly if timeout is small
            # But we respect simulation clock: detection will happen after timeout
            # However, we can also attempt to pre-detect for rerouting demonstration
            # by checking if time already advanced past timeout (which it hasn't)
            pass

    def recover_link(self, u: str, v: str) -> None:
        key = tuple(sorted((u, v)))
        if not self.topology.graph.has_edge(u, v):
            if not self.topology.graph.has_edge(v, u):
                raise ValueError(f"Link {u}-{v} does not exist.")

        self.topology.recover_link(u, v)

        comp_str = f"{u}-{v}"
        recovery_time = self.time

        if key in self._failed_links:
            del self._failed_links[key]
        if key in self._detected_links:
            del self._detected_links[key]

        self.metrics.update_recovery_recovered(comp_str, recovery_time)

        self._log_event(
            EventType.LINK_RECOVERED,
            f"Link {u}↔{v} recovered at {recovery_time:.2f}s",
            component=comp_str,
            recovery_time=recovery_time,
        )

        # Recalculate routes - recovery may provide better paths
        for flow in self.active_flows.values():
            if flow.status == "FAILED":
                # Try to recover failed flows
                try:
                    new_route, new_cost = self.router.shortest_path(
                        self.topology, flow.source, flow.destination
                    )
                    flow.current_route = new_route
                    flow.route_cost = new_cost
                    flow.route_status = "HEALTHY"
                    flow.status = "ACTIVE"
                    self._log_event(
                        EventType.ROUTE_RECALCULATED,
                        f"Route restored for flow {flow.flow_id} after {comp_str} recovery",
                        component=comp_str,
                        flow_id=flow.flow_id,
                        new_route=new_route,
                        route_cost=new_cost,
                    )
                except ValueError:
                    pass
            else:
                # Check if new route is better
                try:
                    new_route, new_cost = self.router.shortest_path(
                        self.topology, flow.source, flow.destination
                    )
                    # If cost is significantly lower, switch back
                    if new_cost < flow.route_cost * 0.9:
                        flow.previous_route = flow.current_route.copy()
                        flow.current_route = new_route
                        flow.route_cost = new_cost
                        flow.route_status = "HEALTHY"
                        self._log_event(
                            EventType.ROUTE_RECALCULATED,
                            f"Route optimized for flow {flow.flow_id} after recovery",
                            component=comp_str,
                            flow_id=flow.flow_id,
                            new_route=new_route,
                            route_cost=new_cost,
                        )
                except ValueError:
                    pass

        self.metrics.snapshot(self.time, self.average_congestion(), len(self.active_flows))
        self.after_recovery_metrics = self.metrics.get_latest()

    def fail_node(self, node: str) -> None:
        if node in self._failed_nodes:
            return
        if node not in self.topology.graph:
            raise ValueError(f"Node {node} does not exist.")

        self.topology.fail_node(node)
        failure_time = self.time
        self._failed_nodes[node] = failure_time

        rec = RecoveryRecord(
            failure_time=failure_time,
            component=node,
            component_type="NODE",
        )
        self.metrics.add_recovery_record(rec)

        self._log_event(
            EventType.NODE_FAILED,
            f"Node {node} failed at {failure_time:.2f}s",
            component=node,
            failure_time=failure_time,
        )

        self.metrics.snapshot(self.time, self.average_congestion(), len(self.active_flows))
        self.baseline_metrics = self.metrics.get_latest()

        if self.failure_detection_timeout <= 0:
            self.check_heartbeats()

    def recover_node(self, node: str) -> None:
        if node not in self.topology.graph:
            raise ValueError(f"Node {node} does not exist.")

        self.topology.recover_node(node)
        recovery_time = self.time

        if node in self._failed_nodes:
            del self._failed_nodes[node]
        if node in self._detected_nodes:
            del self._detected_nodes[node]

        self.metrics.update_recovery_recovered(node, recovery_time)

        self._log_event(
            EventType.NODE_RECOVERED,
            f"Node {node} recovered at {recovery_time:.2f}s",
            component=node,
            recovery_time=recovery_time,
        )

        # Similar recovery logic as link
        for flow in self.active_flows.values():
            if flow.status == "FAILED":
                try:
                    new_route, new_cost = self.router.shortest_path(
                        self.topology, flow.source, flow.destination
                    )
                    flow.current_route = new_route
                    flow.route_cost = new_cost
                    flow.route_status = "HEALTHY"
                    flow.status = "ACTIVE"
                    self._log_event(
                        EventType.ROUTE_RECALCULATED,
                        f"Route restored for flow {flow.flow_id} after {node} recovery",
                        component=node,
                        flow_id=flow.flow_id,
                        new_route=new_route,
                    )
                except ValueError:
                    pass

        self.metrics.snapshot(self.time, self.average_congestion(), len(self.active_flows))
        self.after_recovery_metrics = self.metrics.get_latest()

    # ------------------------------------------------------------------
    # Condition updates
    # ------------------------------------------------------------------
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

        comp_str = f"{u}-{v}"

        if latency is not None:
            self._log_event(
                EventType.LINK_UPDATED,
                f"Latency updated on {comp_str} to {latency}ms",
                component=comp_str,
                latency=latency,
            )
        if bandwidth is not None:
            self._log_event(
                EventType.BANDWIDTH_CHANGED,
                f"Bandwidth changed on {comp_str} to {bandwidth} Mbps",
                component=comp_str,
                bandwidth=bandwidth,
            )
        if packet_loss is not None:
            self._log_event(
                EventType.PACKET_LOSS_CHANGED,
                f"Packet loss changed on {comp_str} to {packet_loss:.2%}",
                component=comp_str,
                packet_loss=packet_loss,
            )
        if congestion is not None:
            self._log_event(
                EventType.CONGESTION_CHANGED,
                f"Congestion changed on {comp_str} to {congestion:.2%}",
                component=comp_str,
                congestion=congestion,
            )

        # Check if congestion/loss/bandwidth change should trigger rerouting
        if congestion is not None or packet_loss is not None or bandwidth is not None or latency is not None:
            for flow in self.active_flows.values():
                if flow.status == "FAILED":
                    continue
                if self._route_uses_link(flow.current_route, u, v):
                    try:
                        new_route, new_cost = self.router.shortest_path(
                            self.topology, flow.source, flow.destination
                        )
                        # Calculate current route cost after condition change
                        current_cost = self.router.route_cost(self.topology, flow.current_route)
                        # Reroute if new route is different and cheaper than current route's new cost
                        if new_route != flow.current_route and new_cost < current_cost:
                            flow.previous_route = flow.current_route.copy()
                            flow.current_route = new_route
                            flow.route_cost = new_cost
                            flow.route_status = "REROUTED"
                            self._log_event(
                                EventType.ROUTE_RECALCULATED,
                                f"Route changed due to condition change for flow {flow.flow_id}: {' → '.join(new_route)} cost={new_cost:.2f} (was {current_cost:.2f})",
                                component=comp_str,
                                flow_id=flow.flow_id,
                                old_route=flow.previous_route,
                                new_route=new_route,
                                route_cost=new_cost,
                                old_cost=current_cost,
                            )
                            self._log_event(
                                EventType.TRAFFIC_REROUTED,
                                f"Traffic rerouted for flow {flow.flow_id} due to condition change on {comp_str}",
                                component=comp_str,
                                flow_id=flow.flow_id,
                                route=new_route,
                            )
                    except ValueError:
                        pass

    def set_congestion(self, u: str, v: str, value: float) -> None:
        self.set_link_conditions(u, v, congestion=value)

    def set_packet_loss(self, u: str, v: str, value: float) -> None:
        self.set_link_conditions(u, v, packet_loss=value)

    def set_bandwidth(self, u: str, v: str, value: float) -> None:
        self.set_link_conditions(u, v, bandwidth=value)

    def average_congestion(self) -> float:
        edges = list(self.topology.graph.edges(data=True))

        if not edges:
            return 0.0

        return sum(
            data.get("congestion", 0.0)
            for _, _, data in edges
        ) / len(edges)

    def metrics_snapshot(self) -> Dict[str, Any]:
        return self.metrics.snapshot(
            self.time,
            self.average_congestion(),
            len(self.active_flows),
        )

    def get_current_route(self, source: str, destination: str) -> Tuple[List[str], float, str]:
        """Get current route with status for UI display."""
        try:
            route, cost = self.router.shortest_path(self.topology, source, destination)
            # Determine status based on whether route uses previously failed components
            status = "HEALTHY"
            # Check if any flow using this route is rerouted
            for flow in self.active_flows.values():
                if flow.source == source and flow.destination == destination:
                    status = flow.route_status
                    break
            return route, cost, status
        except ValueError as e:
            return [], float("inf"), f"FAILED: {e}"

    def get_event_log(self, limit: int = 50) -> List[Dict[str, Any]]:
        return self.event_logger.get_legacy_events(limit)

    def get_structured_events(self, limit: int = 50):
        return self.event_logger.get_events(limit)

    def reset(self) -> None:
        self.topology.reset()
        self.scheduler = create_scheduler(self.scheduler_name)
        self.metrics.reset()

        self.time = 0.0
        self.next_packet_id = 1
        self.packets.clear()
        self.events.clear()
        self.event_logger.clear()

        self._failed_links.clear()
        self._failed_nodes.clear()
        self._detected_links.clear()
        self._detected_nodes.clear()

        self.active_flows.clear()
        self.flow_counter = 1
        self.flow_history.clear()

        self.last_heartbeat_check = 0.0
        self.baseline_metrics = None
        self.during_failure_metrics = None
        self.after_recovery_metrics = None

        self._log_event(
            EventType.SIMULATION_RESET,
            "Simulation reset",
        )

    # ------------------------------------------------------------------
    # Backward compatibility helpers
    # ------------------------------------------------------------------
    def get_failed_links(self) -> List[Tuple[str, str]]:
        return list(self._failed_links.keys())

    def get_failed_nodes(self) -> List[str]:
        return list(self._failed_nodes.keys())

    def is_link_failed(self, u: str, v: str) -> bool:
        key = tuple(sorted((u, v)))
        return key in self._failed_links

    def is_node_failed(self, node: str) -> bool:
        return node in self._failed_nodes
