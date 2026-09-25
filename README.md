# NetAdapt — Adaptive and Self-Healing QoS-Based Network Routing System

> An interactive Computer Networks simulation system that dynamically selects routes based on network conditions, detects failures, reroutes traffic automatically, applies QoS scheduling, and analyzes network performance.

![Status](https://img.shields.io/badge/Stage-4%2B5%20Complete-brightgreen)
![Python](https://img.shields.io/badge/Python-3.11%2B-blue)
![Tests](https://img.shields.io/badge/Tests-59%20Passed-success)

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
- Compare FIFO / Priority / WFQ on identical workloads with per-class latency, jitter, loss, PDR and queue waiting time
- Compare Dijkstra and Bellman-Ford routing, and tune route-cost weights to change actual route selection
- Measure performance with real simulated packets
- Visualize topology, routes, failures, and performance interactively

This is a **simulation-based Computer Networks educational project**, not production router software.

---

## Architecture

```
Topology (NetworkX Graph)
   ↓
Adaptive Routing (Dijkstra / Bellman-Ford, configurable weights)
   ↓
Traffic Flows / Packets (QoS)
   ↓
QoS Scheduling (FIFO / Priority / WFQ, per-class statistics)
   ↓
Transmission (latency, bandwidth, loss, congestion)
   ↓
Metrics + Event Logging (overall + per traffic class + queue statistics)
   ↓
Experiment Engine (experiments.py: QoS / stress / routing / combined)
   ↓
Streamlit Dashboard (Network & Traffic · QoS Lab · Routing Lab · Combined Lab)
```

**Simulation Engine is Source of Truth** — UI only visualizes engine data, no fake metrics.

### Core Modules

- `topology.py` — 10-node network (H1-H4 hosts, R1-R6 routers), link properties, UP/DOWN states, fixed layout positions
- `routing.py` — Manual **Dijkstra** and **Bellman-Ford** implementations (not `networkx.shortest_path`), selectable at runtime, dynamic cost = w_latency·latency + w_loss·loss + w_congestion·congestion + w_bandwidth·bandwidth + w_hop·hop, plus `analyze_route`/`route_info` route-condition analysis
- `qos.py` — Packet model, traffic classes (Emergency, VoIP, Video, HTTP, FTP), FIFO, PriorityQueue, WFQ with configurable priorities/weights and full queue statistics
- `experiments.py` — **Stage 4 + 5 experiment engine**: QoS scheduler comparison, congestion stress test, Dijkstra vs Bellman-Ford comparison, routing weight sensitivity, and the six-way combined experiment
- `metrics.py` — Packet tracking, latency, throughput, PDR, loss, congestion, recovery time, time-series history, before/during/after comparison
- `events.py` — Structured event system (TRAFFIC_STARTED, LINK_FAILED, FAILURE_DETECTED, ROUTE_RECALCULATED, TRAFFIC_REROUTED, etc.)
- `simulator.py` — Central engine: heartbeat monitoring, failure detection with measurable delay, automatic rerouting, active traffic flows, congestion/loss/bandwidth effects, simulation clock
- `app.py` — Streamlit interactive dashboard
- `test_simulation.py` — Stage 1 tests
- `test_stage2.py` — Stage 2+3 tests (heartbeat, detection, rerouting, flows, etc.)
- `test_stage4_5.py` — Stage 4+5 tests (routing algorithms, weights, schedulers, per-class metrics, queue statistics, deterministic experiments)

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

### Streamlit Dashboard — *Network & Traffic* tab (Stage 2+3)

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

## Stage 4 — Advanced QoS Laboratory

### Schedulers

| Scheduler | Ordering rule |
|---|---|
| **FIFO** | Arrival order, traffic classes are not differentiated |
| **Priority Queue** | Strict class priority, ties broken by arrival order |
| **WFQ** | Per-class service credits: long-run service share converges to the configured class weight, no class starves |

Traffic classes: **Emergency, VoIP, Video, HTTP, FTP**.

### Configurable priorities and weights

- `configure_priorities({...})` changes the scheduling priority of each traffic class (new packets pick it up immediately, so Priority Queue ordering genuinely changes).
- `WFQ(weights={...})` / `set_weights({...})` set per-class service weights — weights are validated (positive, known classes only).
- Both are configurable from the dashboard (**QoS Lab → Traffic-class configuration**) and are passed into experiments.

### Per-class QoS metrics (from real packet records)

`Metrics.class_metrics()` aggregates the packet records of every traffic class:

- packets sent / delivered / dropped
- average latency
- **jitter** (RFC 3550 style mean absolute consecutive latency difference)
- throughput
- packet loss (%)
- packet delivery ratio (%)
- **average and maximum queue waiting time**

### Queue statistics

Every scheduler is instrumented identically (`QueueStats`, `queue_statistics()`, `class_statistics()`):

- current queue length, maximum queue length
- packets enqueued, packets served
- total / average / maximum waiting time
- per-class enqueue, serve and occupancy counters

Waiting time is measured with the simulation clock: a packet records its arrival time when it is
enqueued and the scheduler reports `pop_time − arrival_time` when it is served, so waiting times
emerge from real congestion instead of being assumed.

### QoS experiments (`experiments.py`)

- `run_qos_experiment(...)` — runs the **same workload on the same network conditions** through FIFO, Priority Queue and WFQ, then reports the actual results per scheduler, per class and per queue.
- `run_qos_stress_test(...)` — congestion stress test (90% congestion, 5% loss, 25 Mbps) where all five classes compete. Delivery is identical across schedulers because the loss realisation is pre-drawn per packet, which isolates the scheduler effect on latency, jitter and waiting time.

The workload is emitted round-robin per traffic class **in arrival order**, so FIFO is a true
arrival-order queue and all classes genuinely compete at the same time.

---

## Stage 5 — Advanced Adaptive Routing

### Algorithms

- **Dijkstra** — label-setting with a binary heap (`settled_nodes`, `relaxations` reported).
- **Bellman-Ford** — label-correcting edge relaxation with early exit and negative-cycle detection (`iterations`, `relaxations` reported).

Both run on the same `NetworkTopology` and the same dynamic link cost, and both are selectable at
runtime (`AdaptiveRouter(algorithm=...)`, `set_algorithm(...)`, dashboard control, `sim.set_router_algorithm(...)`).

### Configurable route-cost weights

```
cost = w_latency · latency
     + w_loss · loss · 100
     + w_congestion · congestion · 100
     + w_bandwidth · (100 / bandwidth)
     + w_hop
```

Weights are read on every link-cost evaluation, so changing them immediately changes the route the
engine selects (completed flows in the live simulator are re-evaluated as well). Measured example
(`run_routing_weight_experiment`, degraded core: 60% congestion and 35% loss on R1-R3/R3-R5,
10 Mbps on R2-R4/R4-R5):

| Weight configuration | Route selected by the engine | Hops |
|---|---|---|
| Balanced (default) | H1 → R1 → R2 → R4 → R5 → H3 | 5 |
| Hop-minimising (`hop=1`, all others 0) | H1 → R1 → R3 → R5 → H3 | 4 |
| Latency-optimised | H1 → R1 → R3 → R5 → H3 | 4 |
| Loss-avoiding | H1 → R1 → R2 → R4 → R5 → H3 | 5 |
| Congestion-avoiding | H1 → R1 → R2 → R4 → R5 → H3 | 5 |
| Bandwidth-optimised | H1 → R1 → R3 → R5 → H3 | 4 |

The condition-aware configurations divert away from the congested/lossy links, while
hop/latency/bandwidth-only configurations take the short path regardless of degradation — the route
change is produced by the routing engine, not by the UI.

### Route analysis and routing experiments

`AdaptiveRouter.analyze_route(topology, path)` / `route_info(...)` report the selected route, route
cost, hop count, summed path latency, end-to-end packet loss, mean congestion and bottleneck
bandwidth. `experiments.run_routing_comparison(...)` runs the same workload with Dijkstra and
Bellman-Ford and compares all of the above plus the algorithmic work performed
(relaxations, iterations, nodes visited).

Both algorithms agree on the selected route and on the optimal cost for every source/destination
pair — an independent cross-check that both implementations are correct.

---

## Combined Routing + QoS Experiment

`experiments.run_combined_experiment(...)` runs all six configurations on the **same topology, same
workload, same network conditions and same seed**:

1. Dijkstra + FIFO
2. Dijkstra + Priority Queue
3. Dijkstra + WFQ
4. Bellman-Ford + FIFO
5. Bellman-Ford + Priority Queue
6. Bellman-Ford + WFQ

Reported comparisons (all read back from the simulation): latency, throughput, packet loss, PDR,
jitter, route cost and hop count, plus queue statistics and per-class tables for every configuration.

Because both routing algorithms find the same optimum, each scheduler's results are reproduced by
both algorithms, which isolates the QoS scheduler as the variable that changes per-class behaviour.

---

## Dashboard Tabs (Stage 4 + 5)

| Tab | Contents |
|---|---|
| **🛰️ Network & Traffic** | Stage 1-3 simulation: traffic generation, fault injection, condition injection, topology view, active route, live metrics, live queue statistics, performance graphs, per-class QoS of the live simulation, event log |
| **🧪 QoS Lab** | Scheduler selection (live + experiment), traffic-class priority/WFQ weight configuration, workload and scenario selection, FIFO vs Priority vs WFQ comparison, congestion stress test, per-class latency/throughput/loss/jitter/waiting-time charts, queue statistics, per-class queue occupancy |
| **🧭 Routing Lab** | Live algorithm selection, routing weight configuration (with presets), Dijkstra vs Bellman-Ford comparison, routing weight sensitivity experiment, route/route-cost/hop-count tables and charts, selected route drawn on the topology, per-class metrics per algorithm |
| **🔬 Combined Lab** | Six-way routing × QoS comparison with six charts (latency, throughput, loss, PDR, jitter, route cost), route/cost/hop table, class-wise comparison across all six configurations, queue statistics per configuration |

All experiment runs use deterministic seeds and report the workload, seed and conditions alongside
the results so each comparison is reproducible.

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

Expected: 59 tests passed (14 Stage 1 + 22 Stage 2+3 + 23 Stage 4+5).

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

## Definition of Done — Stage 4 + 5 Checklist

- [x] FIFO, Priority Queue and WFQ available and selectable
- [x] Configurable traffic-class priorities (Priority Queue)
- [x] Configurable WFQ service weights
- [x] Per-class metrics: latency, throughput, packet loss, PDR, jitter, queue waiting time
- [x] Queue statistics: current length, maximum length, packets served, waiting time
- [x] Per-class queue occupancy and enqueue/serve counters
- [x] QoS comparison experiment on one identical workload and set of conditions
- [x] QoS congestion stress test with all five classes competing
- [x] Dijkstra implemented and validated
- [x] Bellman-Ford implemented and validated
- [x] Dijkstra and Bellman-Ford agree on optimal cost (cross-check)
- [x] Routing algorithm selectable at runtime (engine + dashboard)
- [x] Configurable routing weights: latency, packet loss, congestion, bandwidth, hop count
- [x] Routing weight changes alter the selected route on real conditions
- [x] Routing comparison experiment (route, cost, hops, latency, loss, congestion)
- [x] Routing weight sensitivity experiment
- [x] Six-way combined routing x QoS experiment (same workload, conditions, seed)
- [x] QoS Lab, Routing Lab and Combined Lab dashboard tabs with tables and charts
- [x] All displayed values produced by the simulation engine, no hardcoded results
- [x] Deterministic seeded experiments
- [x] Stage 1-3 tests still pass (36) and 23 Stage 4+5 tests added (59 total)
- [x] README documents Stage 4 + 5

## Project Structure

```
adaptive-self-healing-network-routing/
├── app.py                 # Streamlit dashboard (Network & Traffic + QoS/Routing/Combined labs)
├── topology.py            # Network topology with positions
├── routing.py             # Dijkstra + Bellman-Ford, configurable weights, route analysis
├── qos.py                 # Packets, FIFO / Priority / WFQ, queue stats, class config
├── metrics.py             # Overall + per-class metrics, jitter, recovery tracking
├── events.py              # Structured event system
├── simulator.py           # Central simulator with self-healing (enhanced)
├── experiments.py         # Stage 4 + 5 experiment engine (new)
├── test_simulation.py     # Stage 1 tests
├── test_stage2.py         # Stage 2+3 tests
├── test_stage4_5.py       # Stage 4+5 tests (new)
├── requirements.txt       # Dependencies
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

- Packet loss is determined by the link conditions of the selected route (plus a congestion
  contribution), not by queue overflow, so under identical conditions every scheduler delivers and
  drops the same packets. The scheduler effect therefore shows up in latency, jitter and queue
  waiting time, which is what the per-class tables compare.
- The transmission model charges the full path latency per packet (no pipelining), so at high
  offered load queues build up quickly; this is what makes scheduler differences easy to observe.
- WFQ uses service credits (a virtual-time style scheduler); the long-run service share converges to
  the configured weights but instantaneous service can burst slightly.
- Positions are fixed for visualization clarity, not auto-layout
- Continuous traffic generation creates packets at once with spaced creation times (not real-time streaming)
- Bandwidth reduction affects serialization only, not queuing model
- No authentication/database/cloud (intentionally out of scope)

## License

Educational project for Computer Networks course.
