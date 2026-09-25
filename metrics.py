from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional
import pandas as pd


@dataclass
class PacketRecord:
    packet_id: int
    sent_time: float
    delivered_time: float | None
    latency: float | None
    size: int
    status: str
    flow_id: str | None = None
    route: List[str] | None = None


@dataclass
class RecoveryRecord:
    failure_time: float
    detection_time: float | None = None
    recalculation_time: float | None = None
    recovery_time: float | None = None
    component: str = ""
    component_type: str = ""  # LINK or NODE


class Metrics:
    def __init__(self) -> None:
        self.records: List[PacketRecord] = []
        self.history: List[Dict[str, Any]] = []
        self.recovery_records: List[RecoveryRecord] = []
        self.active_flows_count: int = 0
        self._snapshots_before_failure: List[Dict[str, Any]] = []
        self._snapshots_during_failure: List[Dict[str, Any]] = []
        self._snapshots_after_recovery: List[Dict[str, Any]] = []

    def record(
        self,
        packet_id: int,
        sent_time: float,
        delivered_time: float | None,
        latency: float | None,
        size: int,
        status: str,
        flow_id: str | None = None,
        route: List[str] | None = None,
    ) -> None:
        self.records.append(
            PacketRecord(
                packet_id,
                sent_time,
                delivered_time,
                latency,
                size,
                status,
                flow_id=flow_id,
                route=route,
            )
        )

    def calculate(
        self,
        current_time: float | None = None,
        congestion: float = 0.0,
        active_flows: int | None = None,
    ) -> Dict[str, float]:
        sent = len(self.records)
        delivered = sum(r.status == "DELIVERED" for r in self.records)
        dropped = sum(r.status == "DROPPED" for r in self.records)

        latencies = [
            r.latency
            for r in self.records
            if r.status == "DELIVERED" and r.latency is not None
        ]

        total_bytes = sum(
            r.size for r in self.records if r.status == "DELIVERED"
        )

        duration = max(
            float(current_time or 0.0),
            0.001,
        )

        # Recovery metrics
        detection_times = [
            (r.detection_time - r.failure_time)
            for r in self.recovery_records
            if r.detection_time is not None
        ]
        recovery_times = [
            (r.recovery_time - r.failure_time)
            for r in self.recovery_records
            if r.recovery_time is not None
        ]
        recalc_times = [
            (r.recalculation_time - r.detection_time)
            for r in self.recovery_records
            if r.recalculation_time is not None and r.detection_time is not None
        ]

        avg_detection = sum(detection_times) / len(detection_times) if detection_times else 0.0
        avg_recovery = sum(recovery_times) / len(recovery_times) if recovery_times else 0.0
        avg_recalc = sum(recalc_times) / len(recalc_times) if recalc_times else 0.0

        result: Dict[str, float] = {
            "packets_sent": float(sent),
            "packets_delivered": float(delivered),
            "packets_dropped": float(dropped),
            "average_latency": (
                sum(latencies) / len(latencies)
                if latencies else 0.0
            ),
            "packet_loss": (
                dropped / sent * 100
                if sent else 0.0
            ),
            "packet_delivery_ratio": (
                delivered / sent * 100
                if sent else 0.0
            ),
            "throughput": total_bytes / duration,
            "congestion": max(0.0, min(1.0, congestion)),
            "active_flows": float(active_flows if active_flows is not None else self.active_flows_count),
            "failure_detection_time": float(avg_detection),
            "recovery_time": float(avg_recovery),
            "route_recalculation_time": float(avg_recalc),
        }
        return result

    def snapshot(
        self,
        current_time: float,
        congestion: float = 0.0,
        active_flows: int | None = None,
    ) -> Dict[str, float]:
        values = self.calculate(current_time, congestion, active_flows)
        values["time"] = current_time
        self.history.append(values.copy())
        return values

    def add_recovery_record(self, record: RecoveryRecord) -> None:
        self.recovery_records.append(record)

    def update_recovery_detection(self, component: str, detection_time: float) -> None:
        for r in reversed(self.recovery_records):
            if r.component == component and r.detection_time is None:
                r.detection_time = detection_time
                break

    def update_recovery_recalculation(self, component: str, recalc_time: float) -> None:
        for r in reversed(self.recovery_records):
            if r.component == component and r.recalculation_time is None:
                r.recalculation_time = recalc_time
                break

    def update_recovery_recovered(self, component: str, recovery_time: float) -> None:
        for r in reversed(self.recovery_records):
            if r.component == component and r.recovery_time is None:
                r.recovery_time = recovery_time
                break

    def dataframe(self) -> pd.DataFrame:
        return pd.DataFrame(self.history)

    def records_dataframe(self) -> pd.DataFrame:
        return pd.DataFrame(asdict(r) for r in self.records)

    def recovery_dataframe(self) -> pd.DataFrame:
        return pd.DataFrame(asdict(r) for r in self.recovery_records)

    def reset(self) -> None:
        self.records.clear()
        self.history.clear()
        self.recovery_records.clear()
        self.active_flows_count = 0
        self._snapshots_before_failure.clear()
        self._snapshots_during_failure.clear()
        self._snapshots_after_recovery.clear()

    def export_csv(self, path: str) -> None:
        self.dataframe().to_csv(path, index=False)

    def get_latest(self) -> Dict[str, float]:
        if self.history:
            return self.history[-1]
        return self.calculate(0.0)

    # Before/during/after support
    def save_baseline(self) -> None:
        if self.history:
            self._snapshots_before_failure.append(self.history[-1].copy())

    def save_during_failure(self) -> None:
        if self.history:
            self._snapshots_during_failure.append(self.history[-1].copy())

    def save_after_recovery(self) -> None:
        if self.history:
            self._snapshots_after_recovery.append(self.history[-1].copy())

    def get_comparison(self) -> Dict[str, Dict[str, float]]:
        def avg_snapshots(snapshots: List[Dict[str, Any]]) -> Dict[str, float]:
            if not snapshots:
                return {}
            keys = ["average_latency", "throughput", "packet_loss", "packet_delivery_ratio", "congestion"]
            result = {}
            for k in keys:
                vals = [s.get(k, 0.0) for s in snapshots if k in s]
                result[k] = sum(vals) / len(vals) if vals else 0.0
            return result

        # If no explicit baseline saved, use first half of history as baseline
        if not self._snapshots_before_failure and self.history:
            mid = len(self.history) // 3
            if mid > 0:
                return {
                    "before": avg_snapshots(self.history[:mid]),
                    "during": avg_snapshots(self.history[mid:2*mid]),
                    "after": avg_snapshots(self.history[2*mid:]),
                }

        return {
            "before": avg_snapshots(self._snapshots_before_failure),
            "during": avg_snapshots(self._snapshots_during_failure),
            "after": avg_snapshots(self._snapshots_after_recovery),
        }
