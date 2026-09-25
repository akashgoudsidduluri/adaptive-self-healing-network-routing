"""Educational ARP, ICMP, forwarding, and switching for Stage 7.

Every result is derived from the live topology, adaptive route, device
interfaces, event logger, and simulation clock.  The protocol layer is
intentionally small: it models protocol observability, not a production TCP/IP
stack.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import ipaddress
from typing import Any, Dict, List, Optional

from addressing import validate_ipv4
from devices import Device, RoutingTable, RoutingTableEntry
from events import EventType


@dataclass
class ARPEntry:
    ip_address: str
    mac_address: str
    interface_id: str
    learned_at: float
    expires_at: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ip_address": self.ip_address,
            "mac_address": self.mac_address,
            "interface_id": self.interface_id,
            "learned_at": self.learned_at,
            "expires_at": self.expires_at,
        }


class ARPCache:
    """Per-device ARP cache with deterministic expiry timestamps."""

    def __init__(self, lifetime: float = 20.0) -> None:
        self.lifetime = float(lifetime)
        self._entries: Dict[str, Dict[str, ARPEntry]] = {}

    def lookup(self, ip_address: str, source: Optional[str] = None, now: float = 0.0) -> Optional[ARPEntry]:
        address = str(validate_ipv4(ip_address))
        if source is not None:
            entry = self._entries.get(source, {}).get(address)
            if entry and entry.expires_at >= now:
                return entry
            if entry:
                del self._entries[source][address]
            return None
        for entries in self._entries.values():
            entry = entries.get(address)
            if entry and entry.expires_at >= now:
                return entry
        return None

    def insert(
        self,
        source: str,
        ip_address: str,
        mac_address: str,
        interface_id: str,
        now: float = 0.0,
    ) -> ARPEntry:
        address = str(validate_ipv4(ip_address))
        entry = ARPEntry(address, mac_address, interface_id, now, now + self.lifetime)
        self._entries.setdefault(source, {})[address] = entry
        return entry

    def expire(self, now: float) -> int:
        removed = 0
        for entries in self._entries.values():
            expired = [address for address, entry in entries.items() if entry.expires_at < now]
            for address in expired:
                del entries[address]
                removed += 1
        return removed

    def clear(self) -> None:
        self._entries.clear()

    def to_dict(self) -> Dict[str, Any]:
        return {
            source: {address: entry.to_dict() for address, entry in entries.items()}
            for source, entries in self._entries.items()
        }


@dataclass
class ProtocolPacket:
    source: str
    destination: str
    packet_type: str = "ICMP_ECHO_REQUEST"
    ttl: int = 64
    route: List[str] = field(default_factory=list)
    hops: List[str] = field(default_factory=list)
    delivered: bool = False
    dropped: bool = False
    reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source": self.source,
            "destination": self.destination,
            "packet_type": self.packet_type,
            "ttl": self.ttl,
            "route": list(self.route),
            "hops": list(self.hops),
            "delivered": self.delivered,
            "dropped": self.dropped,
            "reason": self.reason,
        }


@dataclass
class PingResult:
    source: str
    destination: str
    success: bool
    rtt: float
    hops: int
    route: List[str]
    ttl: int
    arp_resolutions: int
    packet_loss: float
    reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source": self.source,
            "destination": self.destination,
            "success": self.success,
            "rtt": self.rtt,
            "rtt_ms": self.rtt * 1000.0,
            "hops": self.hops,
            "route": list(self.route),
            "ttl": self.ttl,
            "arp_resolutions": self.arp_resolutions,
            "packet_loss": self.packet_loss,
            "reason": self.reason,
        }


@dataclass
class SwitchFrame:
    source_mac: str
    destination_mac: str
    ingress_interface: str
    payload: str = "frame"


@dataclass
class SwitchForwardResult:
    switch: str
    action: str
    output_interfaces: List[str]
    destination_mac: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "switch": self.switch,
            "action": self.action,
            "output_interfaces": list(self.output_interfaces),
            "destination_mac": self.destination_mac,
        }


class ProtocolStack:
    """Protocol services attached to one :class:`NetworkSimulator`."""

    def __init__(self, simulator: Any, arp_lifetime: float = 20.0) -> None:
        self.simulator = simulator
        self.arp = ARPCache(arp_lifetime)
        self.routing_tables: Dict[str, RoutingTable] = {}
        self.switch_tables: Dict[str, Dict[str, str]] = {}

    @property
    def now(self) -> float:
        return float(self.simulator.time)

    def _log(self, event_type: str, message: str, component: Optional[str] = None, **details: Any) -> None:
        self.simulator._log_event(event_type, message, component=component, **details)

    def _device(self, name: str) -> Device:
        device = self.simulator.topology.get_device(name)
        if device is None:
            raise ValueError(f"Unknown device {name}")
        return device

    def _interface_for_link(self, source: str, target: str) -> Any:
        source_device = self._device(source)
        link_id = f"{source}-{target}"
        if self.simulator.topology.graph.has_edge(source, target):
            data = self.simulator.topology.graph[source][target]
            if data.get("status") != "UP":
                raise ValueError(f"Link {link_id} is down")
        return source_device.interface_for_link(link_id)

    def _find_device_by_ip(self, address: str) -> Optional[Device]:
        target = str(validate_ipv4(address))
        for device in self.simulator.topology.devices.values():
            for interface in device.interfaces:
                if interface.ip_address == target:
                    return device
        return None

    def arp_lookup(self, source: str, ip_address: str) -> Optional[ARPEntry]:
        """Perform a real request/reply exchange and return the source cache entry."""

        source_device = self._device(source)
        if source_device.status != "UP":
            self._log(EventType.ARP_REQUEST, f"ARP request unavailable: {source} is down", source, target_ip=ip_address, success=False)
            return None
        target = str(validate_ipv4(ip_address))
        self._log(EventType.ARP_REQUEST, f"Who has {target}? Tell {source}", source, target_ip=target, sender_mac=source_device.interfaces[0].mac_address)
        cached = self.arp.lookup(target, source=source, now=self.now)
        if cached is not None:
            self._log(EventType.ARP_CACHE_UPDATE, f"ARP cache hit for {target}", source, target_ip=target, mac_address=cached.mac_address, interface_id=cached.interface_id, cache_hit=True)
            return cached

        owner = self._find_device_by_ip(target)
        if owner is None or owner.status != "UP":
            self._log(EventType.ARP_MISS, f"No ARP reply for {target}", source, target_ip=target)
            return None
        owner_interface = owner.get_interface()
        entry = self.arp.insert(
            source,
            target,
            owner_interface.mac_address or "00:00:00:00:00:00",
            source_device.interface_for_link(f"{source}-{owner.name}").interface_id,
            now=self.now,
        )
        self._log(EventType.ARP_REPLY, f"{owner.name} replied to ARP for {target}", source, target_ip=target, mac_address=entry.mac_address, reply_from=owner.name)
        self._log(EventType.ARP_CACHE_UPDATE, f"ARP cache updated for {target}", source, target_ip=target, mac_address=entry.mac_address, interface_id=entry.interface_id, cache_hit=False)
        return entry

    # Public aliases used by diagnostic callers.
    resolve_arp = arp_lookup
    arp_request = arp_lookup

    def route_inspection(self, source: str, destination: str) -> Dict[str, Any]:
        try:
            route, cost = self.simulator.router.shortest_path(
                self.simulator.topology, source, destination
            )
        except ValueError as exc:
            self._log(EventType.ROUTE_LOOKUP, f"No route from {source} to {destination}", f"{source}→{destination}", success=False, reason=str(exc))
            self._log(EventType.DESTINATION_UNREACHABLE, f"Destination {destination} unreachable from {source}", destination, source=source, destination=destination, reason="NO_ROUTE")
            return {"route": [], "cost": float("inf"), "status": "UNREACHABLE", "reason": str(exc)}
        self._log(EventType.ROUTE_LOOKUP, f"Route lookup {source}→{destination}", f"{source}→{destination}", route=route, route_cost=cost, algorithm=self.simulator.get_router_algorithm())
        return {"route": route, "cost": cost, "status": "OK"}

    def routing_table(self, router_name: str) -> RoutingTable:
        """Build a real route-derived table from the current adaptive routes."""

        table = self.routing_tables.setdefault(router_name, RoutingTable(router_name))
        table.clear()
        router = self._device(router_name)
        if not router.is_router:
            raise ValueError(f"{router_name} is not a router")
        for destination in self.simulator.topology.nodes():
            if destination == router_name:
                continue
            try:
                route, cost = self.simulator.router.shortest_path(
                    self.simulator.topology, router_name, destination
                )
            except ValueError:
                continue
            next_hop = route[1] if len(route) > 1 else None
            interface = router.interface_for_link(f"{router_name}-{next_hop}") if next_hop else router.interfaces[0]
            target_device = self.simulator.topology.get_device(destination)
            if target_device and target_device.interfaces and target_device.interfaces[0].ip_address:
                target_interface = target_device.interfaces[0]
                # Use a host route for exact device destinations; the table is
                # diagnostic and remains derived from the current live path.
                table.add(target_interface.ip_address, 32, next_hop, interface.interface_id, cost)
        return table

    def routing_table_lookup(self, router_name: str, destination_ip: str) -> Optional[RoutingTableEntry]:
        table = self.routing_table(router_name)
        return table.lookup(destination_ip)

    def forward_packet(
        self,
        packet: ProtocolPacket,
        route: Optional[List[str]] = None,
        ttl: Optional[int] = None,
    ) -> ProtocolPacket:
        """Forward a protocol packet hop-by-hop with real TTL semantics."""

        if not isinstance(packet, ProtocolPacket):
            packet = ProtocolPacket(
                source=packet.source,
                destination=packet.destination,
                packet_type=getattr(packet, "packet_type", "IP"),
                ttl=int(getattr(packet, "ttl", 64)),
                route=list(getattr(packet, "route", []) or []),
            )
        if ttl is not None:
            packet.ttl = int(ttl)
        if int(packet.ttl) < 1:
            packet.dropped = True
            packet.reason = "TTL_EXCEEDED"
            self._log(EventType.ICMP_TTL_EXCEEDED, f"TTL exceeded before forwarding {packet.source}→{packet.destination}", packet.source, ttl=packet.ttl)
            return packet
        if route is not None:
            packet.route = list(route)
        if not packet.route:
            inspection = self.route_inspection(packet.source, packet.destination)
            packet.route = list(inspection["route"])
            if not packet.route:
                packet.dropped = True
                packet.reason = "DESTINATION_UNREACHABLE"
                self._log(EventType.DESTINATION_UNREACHABLE, f"Destination {packet.destination} unreachable", packet.destination, source=packet.source)
                return packet
        if packet.route[0] != packet.source or packet.route[-1] != packet.destination:
            packet.dropped = True
            packet.reason = "INVALID_ROUTE"
            return packet

        for current, next_hop in zip(packet.route, packet.route[1:]):
            if not self.simulator.topology.active_node(current) or not self.simulator.topology.active_node(next_hop):
                packet.dropped = True
                packet.reason = "NODE_DOWN"
                self._log(EventType.DESTINATION_UNREACHABLE, f"Packet dropped: {current} or {next_hop} is down", current, source=packet.source, destination=packet.destination)
                break
            if not self.simulator.topology.active_link(current, next_hop):
                packet.dropped = True
                packet.reason = "LINK_DOWN"
                self._log(EventType.DESTINATION_UNREACHABLE, f"Packet dropped: link {current}-{next_hop} is down", f"{current}-{next_hop}", source=packet.source, destination=packet.destination)
                break
            if current != packet.source:
                if packet.ttl <= 1:
                    packet.ttl = 0
                    packet.dropped = True
                    packet.reason = "TTL_EXCEEDED"
                    self._log(EventType.ICMP_TTL_EXCEEDED, f"TTL exceeded at {current}", current, source=packet.source, destination=packet.destination, ttl=packet.ttl)
                    break
                packet.ttl -= 1
            packet.hops.append(next_hop)
            self._log(EventType.PACKET_FORWARDED, f"Forwarded {packet.packet_type} {current}→{next_hop}", f"{current}→{next_hop}", source=packet.source, destination=packet.destination, ttl=packet.ttl, next_hop=next_hop)
            if packet.hops[-1] == packet.destination:
                packet.delivered = True
                break
        return packet

    def ping(self, source: str, destination: str, ttl: int = 64) -> PingResult:
        """Run a deterministic ICMP echo exchange over the live route."""

        if source == destination:
            result = PingResult(source, destination, False, 0.0, 0, [], int(ttl), 0, 0.0, "SAME_ENDPOINT")
            self._log(EventType.DESTINATION_UNREACHABLE, "Cannot ping a device to itself", source, source=source, destination=destination)
            return result
        inspection = self.route_inspection(source, destination)
        route = inspection["route"]
        if not route:
            return PingResult(source, destination, False, 0.0, 0, [], int(ttl), 0, 0.0, "NO_ROUTE")

        self._log(EventType.ICMP_ECHO_REQUEST, f"Ping {source}→{destination}", f"{source}→{destination}", source=source, destination=destination, ttl=int(ttl), route=route)
        arp_resolutions = 0
        for current, next_hop in zip(route, route[1:]):
            next_device = self.simulator.topology.get_device(next_hop)
            if not next_device or not next_device.interfaces or not next_device.interfaces[0].ip_address:
                return PingResult(source, destination, False, 0.0, 0, route, int(ttl), arp_resolutions, 0.0, "NO_NEXT_HOP_IP")
            if self.arp_lookup(current, next_device.interfaces[0].ip_address or "") is None:
                return PingResult(source, destination, False, 0.0, 0, route, int(ttl), arp_resolutions, 0.0, "ARP_RESOLUTION_FAILED")
            arp_resolutions += 1

        packet = ProtocolPacket(source, destination, "ICMP_ECHO_REQUEST", int(ttl), route)
        packet = self.forward_packet(packet, route=route)
        packet_loss = self._route_loss(route)
        if packet.dropped or packet_loss >= 1.0:
            if packet_loss >= 1.0 and not packet.dropped:
                packet.dropped = True
                packet.reason = "PACKET_LOSS"
                self._log(EventType.PACKET_DROPPED, f"ICMP echo dropped by configured link loss on {source}→{destination}", f"{source}→{destination}", source=source, destination=destination, reason="PACKET_LOSS", packet_loss=packet_loss)
            return PingResult(source, destination, False, 0.0, len(packet.hops), route, packet.ttl, arp_resolutions, packet_loss, packet.reason)
        self._log(EventType.ICMP_ECHO_REPLY, f"Ping reply {destination}→{source}", f"{destination}→{source}", source=source, destination=destination, hops=len(packet.hops), rtt=self._route_rtt(route))
        return PingResult(source, destination, True, self._route_rtt(route), len(packet.hops), route, packet.ttl, arp_resolutions, packet_loss, None)

    def _route_loss(self, route: List[str]) -> float:
        no_loss = 1.0
        for current, next_hop in zip(route, route[1:]):
            data = self.simulator.topology.graph[current][next_hop]
            loss = min(1.0, max(0.0, float(data.get("packet_loss", 0.0)) + float(data.get("congestion", 0.0)) * 0.05))
            no_loss *= 1.0 - loss
        return 1.0 - no_loss

    def _route_rtt(self, route: List[str]) -> float:
        return sum(
            float(self.simulator.topology.graph[current][next_hop].get("latency", 0.0))
            for current, next_hop in zip(route, route[1:])
        ) / 1000.0

    def switch_frame(self, switch_name: str, frame: SwitchFrame, available_interfaces: Optional[List[str]] = None) -> SwitchForwardResult:
        """Learn a source MAC and forward/flood a simplified Layer-2 frame."""

        switch = self._device(switch_name)
        if not switch.is_switch:
            raise ValueError(f"{switch_name} is not a switch")
        if switch.status != "UP":
            raise ValueError(f"Switch {switch_name} is down")
        switch.learn_mac(frame.source_mac, frame.ingress_interface)
        self.switch_tables[switch_name] = dict(switch.mac_table)
        self._log(EventType.MAC_LEARNED, f"Switch learned {frame.source_mac} on {frame.ingress_interface}", switch_name, source_mac=frame.source_mac, interface_id=frame.ingress_interface)
        if not frame.destination_mac or frame.destination_mac.lower() in {"ff:ff:ff:ff:ff:ff", "broadcast"}:
            outputs = [item for item in (available_interfaces or [i.interface_id for i in switch.interfaces]) if item != frame.ingress_interface]
            self._log(EventType.MAC_FLOOD, f"Broadcast flooded from {switch_name}", switch_name, destination_mac=frame.destination_mac, output_interfaces=outputs)
            return SwitchForwardResult(switch_name, "FLOOD", outputs, frame.destination_mac)
        output = switch.lookup_mac(frame.destination_mac)
        if output is None or output == frame.ingress_interface:
            outputs = [item for item in (available_interfaces or [i.interface_id for i in switch.interfaces]) if item != frame.ingress_interface]
            self._log(EventType.MAC_FLOOD, f"Unknown destination {frame.destination_mac}; flooding {switch_name}", switch_name, destination_mac=frame.destination_mac, output_interfaces=outputs)
            return SwitchForwardResult(switch_name, "FLOOD", outputs, frame.destination_mac)
        return SwitchForwardResult(switch_name, "FORWARD", [output], frame.destination_mac)

    def mac_table_lookup(self, switch_name: str, mac_address: str) -> Optional[str]:
        switch = self._device(switch_name)
        if not switch.is_switch:
            raise ValueError(f"{switch_name} is not a switch")
        return switch.lookup_mac(mac_address)
