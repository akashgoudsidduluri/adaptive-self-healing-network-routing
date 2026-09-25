"""
Event system for NetAdapt simulation.

Provides structured event logging with simulation timestamps.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional
import enum


class EventType(str, enum.Enum):
    TRAFFIC_STARTED = "TRAFFIC_STARTED"
    PACKET_SENT = "PACKET_SENT"
    PACKET_DELIVERED = "PACKET_DELIVERED"
    PACKET_DROPPED = "PACKET_DROPPED"
    LINK_FAILED = "LINK_FAILED"
    NODE_FAILED = "NODE_FAILED"
    FAILURE_DETECTED = "FAILURE_DETECTED"
    ROUTE_RECALCULATED = "ROUTE_RECALCULATED"
    TRAFFIC_REROUTED = "TRAFFIC_REROUTED"
    LINK_RECOVERED = "LINK_RECOVERED"
    NODE_RECOVERED = "NODE_RECOVERED"
    CONGESTION_CHANGED = "CONGESTION_CHANGED"
    PACKET_LOSS_CHANGED = "PACKET_LOSS_CHANGED"
    BANDWIDTH_CHANGED = "BANDWIDTH_CHANGED"
    SIMULATION_RESET = "SIMULATION_RESET"
    LINK_UPDATED = "LINK_UPDATED"
    PACKET_GENERATED = "PACKET_GENERATED"
    FLOW_COMPLETED = "FLOW_COMPLETED"
    FLOW_FAILED = "FLOW_FAILED"
    SCHEDULER_CHANGED = "SCHEDULER_CHANGED"
    QOS_CONFIG_CHANGED = "QOS_CONFIG_CHANGED"
    ROUTING_ALGORITHM_CHANGED = "ROUTING_ALGORITHM_CHANGED"
    ROUTING_WEIGHTS_CHANGED = "ROUTING_WEIGHTS_CHANGED"


@dataclass
class Event:
    """Structured simulation event."""

    timestamp: float
    event_type: str
    message: str
    component: Optional[str] = None
    flow_id: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "time": round(self.timestamp, 4),
            "event": self.event_type,
            "component": self.component,
            "flow_id": self.flow_id,
            "message": self.message,
            "details": self.details,
        }

    def to_legacy_dict(self) -> Dict[str, Any]:
        """Convert to legacy flat dict format for backward compatibility."""
        d = {
            "time": round(self.timestamp, 4),
            "event": self.event_type,
            "message": self.message,
        }
        if self.component:
            # Preserve old keys like link, node for compatibility
            if "-" in self.component or "↔" in self.component:
                d["link"] = self.component
            else:
                d["node"] = self.component
            d["component"] = self.component
        if self.flow_id:
            d["flow_id"] = self.flow_id
        d.update(self.details)
        return d


class EventLogger:
    """Manages event logging with simulation clock."""

    def __init__(self) -> None:
        self.events: list[Event] = []
        self._legacy_events: list[Dict[str, Any]] = []

    def log(
        self,
        timestamp: float,
        event_type: str,
        message: str,
        component: Optional[str] = None,
        flow_id: Optional[str] = None,
        **details: Any,
    ) -> Event:
        evt = Event(
            timestamp=timestamp,
            event_type=event_type,
            message=message,
            component=component,
            flow_id=flow_id,
            details=details,
        )
        self.events.append(evt)
        self._legacy_events.append(evt.to_legacy_dict())
        return evt

    def get_events(self, limit: Optional[int] = None) -> list[Event]:
        if limit is None:
            return list(self.events)
        return list(self.events[-limit:])

    def get_legacy_events(self, limit: Optional[int] = None) -> list[Dict[str, Any]]:
        if limit is None:
            return list(self._legacy_events)
        return list(self._legacy_events[-limit:])

    def clear(self) -> None:
        self.events.clear()
        self._legacy_events.clear()

    def to_dict_list(self) -> list[Dict[str, Any]]:
        return [e.to_dict() for e in self.events]
