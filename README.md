# NetAdapt — Adaptive and Self-Healing QoS-Based Network Routing System

> An interactive Computer Networks simulation system that dynamically selects routes based on network conditions, detects failures, reroutes traffic automatically, applies QoS scheduling, and analyzes network performance.

![Status](https://img.shields.io/badge/Stage-2%2B3%20Complete-brightgreen)
![Python](https://img.shields.io/badge/Python-3.11%2B-blue)
![Tests](https://img.shields.io/badge/Tests-36%20Passed-success)

## Overview

Modern computer networks operate under continuously changing conditions. Traffic levels can increase, links can become congested, packet loss can occur, bandwidth can decrease, and routers or communication links can fail.

Traditional shortest-path routing may continue using a route even when its current conditions are poor.

**NetAdapt** is an interactive network simulation laboratory that demonstrates how a network can adapt to these changes:

- Monitor simulated network conditions
- Select suitable routes dynamically (Dijkstra with dynamic cost)
- Detect link/node failures via heartbeat simulation
- Automatically recalculate alternative routes
- Redirect traffic through available paths
- Simulate congestion, packet loss, bandwidth reduction
- Apply QoS scheduling (FIFO, Priority Queue, WFQ)
- Measure performance with real simulated packets
- Visualize topology, routes, failures, and performance interactively

This is a **simulation-based Computer Networks educational project**, not production router software.

---

## Architecture

```
Topology (NetworkX Graph)
   ↓
Adaptive Routing (Manual Dijkstra)
   ↓
Traffic Flows / Packets (QoS)
   ↓
QoS Scheduling (FIFO / Priority / WFQ)
   ↓
Transmission (latency, bandwidth, loss, congestion)
   ↓
Metrics + Event Logging
   ↓
Streamlit Dashboard (Control + Visualization)
```

**Simulation Engine is Source of Truth** — UI only visualizes engine data, no fake metrics.

### Core Modules

- `topology.py` — 10-node network (H1-H4 hosts, R1-R6 routers), link properties, UP/DOWN states, fixed layout positions
- `routing.py` — Manual Dijkstra implementation (not `networkx.shortest_path`), dynamic cost = latency + loss + congestion + bandwidth + hop
- `qos.py` — Packet model, traffic classes (Emergency, VoIP, Video, HTTP, FTP), FIFO, PriorityQueue, WFQ
- `metrics.py` — Packet tracking, latency, throughput, PDR, loss, congestion, recovery time, time-series history, before/during/after comparison
- `events.py` — Structured event system (TRAFFIC_STARTED, LINK_FAILED, FAILURE_DETECTED, ROUTE_RECALCULATED, TRAFFIC_REROUTED, etc.)
- `simulator.py` — Central engine: heartbeat monitoring, failure detection with measurable delay, automatic rerouting, active traffic flows, congestion/loss/bandwidth effects, simulation clock
- `app.py` — Streamlit interactive dashboard
- `test_simulation.py` — Stage 1 tests
- `test_stage2.py` — Stage 2+3 tests (heartbeat, detection, rerouting, flows, etc.)

---

## Implemented Features (Stage 2+3)

### Self-Healing Network

- **Heartbeat / Health Check**: Simulated periodic health checks with configurable interval and detection timeout. No `time.sleep()` — uses simulation clock.
- Tracks `failure_time`, `detection_time`, `recalculation_time`, `recovery_time` with measurable delays.
- Failure detection timeout default 2.0s simulated time.

### Automatic Failure Handling

When link fails:
1. Mark link DOWN, record failure time
2. After detection timeout, emit `FAILURE_DETECTED`
3. Prevent routing through it
4. Recalculate routes for affected flows
5. Find alternative path (dynamic Dijkstra)
6. Reroute traffic, emit `ROUTE_RECALCULATED` + `TRAFFIC_REROUTED`
7. Measure detection/recovery time

When node fails: similar, removes all affected paths.

If no alternative route: traffic fails/drops appropriately, event logged, metrics reflect failure.

### Dynamic Routing Demonstration

Example:
```
Normal: H1 → R1 → R3 → R5 → H3
After R3-R5 fails: H1 → R1 → R3 → R4 → R5 → H3 (calculated, not hardcoded)
```

### Active Traffic Flows

Each flow contains:
- flow ID, source, destination, traffic type
- packet count, packet size, pps, duration
- start time, status, current route, route cost, route status
- packets sent/delivered/dropped
- detection/recovery times

Supports multiple simultaneous flows (e.g., H1→H3 Video, H2→H4 HTTP, H3→H1 VoIP).

### Dynamic Traffic Generation

- One-time bursts and continuous traffic
- Configurable packets/sec, packet size, duration
- Multiple simultaneous flows
- Creates actual Packet objects through simulation pipeline

### Congestion Simulation

- Congestion influences route cost, route selection, transmission latency, packet loss, metrics
- Example: congestion on R1-R3 increases cost, router may select alternative path if cheaper
- Transmission time = (latency * congestion_factor) + (serialization * congestion_factor)

### Packet-Loss Injection

- User can increase loss probability on selected links
- Affects actual packet delivery via `_packet_loss_probability`
- Effective loss = packet_loss + congestion*0.05
- Metrics reflect real simulation

### Bandwidth Reduction

- User can reduce bandwidth on selected link (e.g., 100 Mbps → 20 Mbps)
- Influences actual transmission time: serialization = size_bytes / (bandwidth_Mbps * 125000)
- Correct unit conversions, not just label change

### Simulation Clock

- Tracks current simulation time, packet creation/delivery times, failure/detection/recalculation/recovery times
- Runs quickly without real-time sleeping
- `tick(delta)` advances clock and checks heartbeats

### Event System

Structured events with timestamp, type, component, flow, message:

```
TRAFFIC_STARTED, PACKET_SENT, PACKET_DELIVERED, PACKET_DROPPED,
LINK_FAILED, NODE_FAILED, FAILURE_DETECTED, ROUTE_RECALCULATED,
TRAFFIC_REROUTED, LINK_RECOVERED, NODE_RECOVERED,
CONGESTION_CHANGED, PACKET_LOSS_CHANGED, BANDWIDTH_CHANGED
```

### Metrics

- Average latency, throughput, packet loss, PDR, congestion
- Packets sent/delivered/dropped, active flows
- Failure detection time, route recalculation time, recovery time
- Time-series history, CSV export, before/during/after comparison

### Streamlit Dashboard

**Header**: Title + description

**Network Status**: total/active nodes/links, active flows, sim time

**Network Topology**: Real visual graph from NetworkX (Plotly), fixed layout:
- Hosts (square) vs Routers (circle)
- Active/inactive nodes/links visually distinct (red for failed, green for active route, orange for congested)
- Selected route highlighted
- Hover details for latency, bandwidth, loss, congestion

**Traffic Control**: Source, Destination, Traffic Type, Packet Count, Packet Size, Packets/sec, Duration + Generate Traffic, Run Simulation, Tick, Reset

**Fault Injection**: Select link/node, Fail/Recover Link/Node, Increase Congestion, Increase Packet Loss, Reduce Bandwidth, Reset Conditions

**Active Route**: Source, Destination, Current route, Cost, Status (HEALTHY/REROUTED/FAILED)

**Live Metrics**: Cards for Latency, Throughput, Loss, PDR, Congestion, Recovery Time

**Performance Graphs**: Plotly time-series for latency, throughput, loss, PDR, congestion + before/during/after comparison

**Event Log**: Recent events with simulation timestamps

**Session State**: Simulator persists between reruns, reset creates clean state

---

## Installation

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

Dependencies:
- networkx>=3.2
- numpy>=1.26
- pandas>=2.0
- streamlit>=1.35
- plotly>=5.20
- pytest>=8.0

## Run Application

```bash
streamlit run app.py
```

Open browser at displayed URL (typically http://localhost:8501).

## Run Tests

```bash
pytest -v
```

Expected: 36 tests passed (14 Stage 1 + 22 Stage 2+3).

## Demonstration Scenario (Required)

This workflow must work through UI:

1. **Open NetAdapt**: `streamlit run app.py`
2. **Observe network topology**: 10 nodes, multiple paths, default positions
3. **Select**: Source=H1, Destination=H3
4. **Generate Video traffic**: 20 packets, 1000 bytes, 10 pps
5. **Run Simulation**: Click "Run Simulation", observe active route (e.g., H1→R1→R3→R5→H3), packets, latency, throughput, loss, PDR
6. **Introduce congestion**: Select link R1-R3, set congestion 0.8, observe if adaptive routing changes route based on calculated cost
7. **Fail internal link**: Select R3-R5, click "Fail Link" — system advances time by detection timeout + 0.5s
8. **Heartbeat detection**: Check event log for `FAILURE_DETECTED` after measurable delay (e.g., 2.0s)
9. **Routing recalculates**: Event log shows `ROUTE_RECALCULATED`
10. **Traffic rerouted**: Event log shows `TRAFFIC_REROUTED`, active route changes to alternative (e.g., via R4)
11. **Event log records**: failure, detection, recalculation, rerouting with simulation timestamps
12. **Observe changed metrics**: Latency may increase, throughput may change, PDR affected
13. **Recover failed link**: Select R3-R5, click "Recover Link"
14. **Continue simulation**: Generate new traffic, run simulation
15. **Compare before/after**: Performance graphs show time-series, comparison table shows before/during/after metrics

All steps use real simulation engine, no hardcoded routes or fake metrics.

## Code Quality

- Type hints throughout
- Clean modular design, no duplicated logic
- Docstrings for public methods
- Deterministic random seed support
- No hardcoded routes, no fake metrics, no UI-only simulation logic
- Preserves Stage 1 architecture

## Future Stage (Not in Scope)

Advanced QoS comparison remains future:

- FIFO vs Priority Queue vs WFQ experiments
- Traffic-class comparison (per-class latency, loss, fairness)
- Bandwidth allocation analytics
- QoS analytics dashboard

Current QoS infrastructure remains intact for future extension.

## Project Structure

```
adaptive-self-healing-network-routing/
├── app.py                 # Streamlit dashboard (Stage 2+3)
├── topology.py            # Network topology with positions
├── routing.py             # Adaptive Dijkstra router
├── qos.py                 # Packets & scheduling
├── metrics.py             # Metrics + recovery tracking
├── events.py              # Structured event system (new)
├── simulator.py           # Central simulator with self-healing (enhanced)
├── test_simulation.py     # Stage 1 tests
├── test_stage2.py         # Stage 2+3 tests (new)
├── requirements.txt       # Dependencies
├── requirements.py        # Legacy compat
└── README.md
```

## Definition of Done — Stage 2+3 Checklist

- [x] Existing Stage 1 tests pass
- [x] Failure detection works (heartbeat with timeout)
- [x] Heartbeat simulation works
- [x] Link failures detected with measurable delay
- [x] Node failures detected
- [x] Routes dynamically recalculated
- [x] Alternative routes selected automatically (not hardcoded)
- [x] Traffic flows work
- [x] Multiple flows work
- [x] Congestion affects routing/performance
- [x] Packet loss affects actual delivery
- [x] Bandwidth affects transmission time
- [x] Simulation clock works (no time.sleep)
- [x] Event logging works with timestamps
- [x] Recovery measurable (detection, recalculation, recovery times)
- [x] Metrics from real simulation data
- [x] Network topology visually displayed (Plotly, real NetworkX graph)
- [x] Active route visualized (green highlight)
- [x] Failed links/nodes visualized (red)
- [x] Traffic controls work
- [x] Fault injection controls work
- [x] Performance graphs work (Plotly time-series)
- [x] Event log works
- [x] Before/after comparison works
- [x] Streamlit session state persists
- [x] Reset works
- [x] Tests added and passing (22 new)
- [x] README updated
- [x] No fake/hardcoded results

## Known Limitations

- WFQ is basic structure, full QoS comparison is future stage
- Positions are fixed for visualization clarity, not auto-layout
- Continuous traffic generation creates packets at once with spaced creation times (not real-time streaming)
- Bandwidth reduction affects serialization only, not queuing model
- No authentication/database/cloud (intentionally out of scope)

## License

Educational project for Computer Networks course.
