from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any
import pandas as pd


@dataclass
class PacketRecord:
    packet_id: int
    sent_time: float
    delivered_time: float | None
    latency: float | None
    size: int
    status: str


class Metrics:
    def __init__(self) -> None:
        self.records: list[PacketRecord] = []
        self.history: list[dict[str, Any]] = []

    def record(
        self,
        packet_id: int,
        sent_time: float,
        delivered_time: float | None,
        latency: float | None,
        size: int,
        status: str,
    ) -> None:
        self.records.append(
            PacketRecord(
                packet_id,
                sent_time,
                delivered_time,
                latency,
                size,
                status,
            )
        )

    def calculate(
        self,
        current_time: float | None = None,
        congestion: float = 0.0,
    ) -> dict[str, float]:
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

        return {
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
        }

    def snapshot(
        self,
        current_time: float,
        congestion: float = 0.0,
    ) -> dict[str, float]:
        values = self.calculate(current_time, congestion)
        values["time"] = current_time
        self.history.append(values.copy())
        return values

    def dataframe(self) -> pd.DataFrame:
        return pd.DataFrame(self.history)

    def records_dataframe(self) -> pd.DataFrame:
        return pd.DataFrame(asdict(r) for r in self.records)

    def reset(self) -> None:
        self.records.clear()
        self.history.clear()

    def export_csv(self, path: str) -> None:
        self.dataframe().to_csv(path, index=False)