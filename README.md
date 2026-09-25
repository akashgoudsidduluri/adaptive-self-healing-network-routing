# NetAdapt — Adaptive and Self-Healing QoS-Based Network Routing System

> An interactive Computer Networks simulation system that dynamically selects routes based on network conditions, detects failures, reroutes traffic automatically, applies QoS scheduling, and analyzes network performance.

![Status](https://img.shields.io/badge/Stage-6%20Complete-brightgreen)
![Python](https://img.shields.io/badge/Python-3.11%2B-blue)
![Tests](https://img.shields.io/badge/Tests-98%20Passed-success)

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
- Run whole network scenarios (congestion, packet loss, reduced bandwidth, link/router/multiple
  failures, combined degradations) from reusable, reproducible presets
- Evaluate resilience: failure, detection, recalculation and recovery timing, packets affected and
  packets delivered after recovery
- Track route stability (the actual route history of every flow) and sweep a single network
  parameter to measure sensitivity
- Measure performance with real simulated packets
- Visualize topology, routes, failures, and performance interactively
- Operate a Packet Tracer-style SVG workspace with real packet animation, device/link inspection,
  simulation controls, live queues and an event timeline

This is a **simulation-based Computer Networks educational project**, not production router software.

## Interactive Network Workspace

The default application view is now a live network laboratory rather than an analytics dashboard.
A custom SVG workspace renders the existing 10-device topology with router and PC symbols, status
LEDs, cable labels, congestion colours, failed links and the engine-selected active route.

- **Real packet animation:** `STEP`, `PLAY` and `RUN ALL` call
  `NetworkSimulator.process_next_packet()`. The SVG animates the returned packet along its actual
  `Packet.route`; it does not generate independent frontend traffic.
- **Traffic classes:** Emergency, VoIP, Video, HTTP and FTP use distinct packet colours and real
  scheduler priority.
- **Simulation controls:** reset, step, play, pause, run-all, 1x/2x/5x/10x speed and simulation time.
- **Traffic generator:** source, destination, class, packet size/count/rate and SEND PACKETS.
- **Inspection:** click a packet, device or cable in the workspace, or use the lower packet/device/
  link/queue/event/metrics panels.
- **Faults and conditions:** fail/recover links and nodes; edit congestion, packet loss and bandwidth.
  A failed link advances the real simulation clock through heartbeat detection and rerouting.
- **Routing and QoS:** select Dijkstra/Bellman-Ford, edit real route-cost weights, and switch the live
  scheduler between FIFO, Priority Queue and WFQ.

The original Plotly topology, traffic controls, charts, QoS Lab, Routing Lab, Combined Lab and
Scenario Lab remain available below the workspace as secondary analysis and experiment surfaces.

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
Scenario Framework (scenarios.py: presets, phased runs, resilience, multi-run,
                    route stability, sensitivity, comparison, export)
   ↓
Interactive SVG Workspace (real packet/event state + inspectors)
   ↓
Streamlit Analysis & Experiment Labs (Traffic · QoS · Routing · Combined · Scenario)
```

**Simulation Engine is Source of Truth** — UI only visualizes engine data, no fake metrics.

### Core Modules

- `topology.py` — 10-node network (H1-H4 hosts, R1-R6 routers), link properties, UP/DOWN states, fixed layout positions
- `routing.py` — Manual **Dijkstra** and **Bellman-Ford** implementations (not `networkx.shortest_path`), selectable at runtime, dynamic cost = w_latency·latency + w_loss·loss + w_congestion·congestion + w_bandwidth·bandwidth + w_hop·hop, plus `analyze_route`/`route_info` route-condition analysis
- `qos.py` — Packet model, traffic classes (Emergency, VoIP, Video, HTTP, FTP), FIFO, PriorityQueue, WFQ with configurable priorities/weights and full queue statistics
- `experiments.py` — **Stage 4 + 5 experiment engine**: QoS scheduler comparison, congestion stress test, Dijkstra vs Bellman-Ford comparison, routing weight sensitivity, and the six-way combined experiment
- `scenarios.py` — **Stage 6 scenario framework**: named scenario presets, the phased scenario runner (before / during / after), resilience evaluation, route-stability tracking, multi-run experiments, sensitivity sweeps, scenario comparison and CSV export
- `metrics.py` — Packet tracking, latency, throughput, PDR, loss, congestion, recovery time, time-series history, before/during/after comparison
- `events.py` — Structured event system (TRAFFIC_STARTED, LINK_FAILED, FAILURE_DETECTED, ROUTE_RECALCULATED, TRAFFIC_REROUTED, etc.)
- `simulator.py` — Central engine: heartbeat monitoring, failure detection with measurable delay, automatic rerouting, active traffic flows, congestion/loss/bandwidth effects, simulation clock
- `app.py` — Streamlit shell: primary network workspace plus all existing analysis/experiment labs
- `network_workspace.py` — Engine-backed SVG workspace, real packet trace stepping, inspectors, controls and secondary panels
- `scenario_lab.py` — Stage 6 "Scenario Lab" tab (rendered by `app.py`)
- `test_simulation.py` — Stage 1 tests
- `test_stage2.py` — Stage 2+3 tests (heartbeat, detection, rerouting, flows, etc.)
- `test_stage4_5.py` — Stage 4+5 tests (routing algorithms, weights, schedulers, per-class metrics, queue statistics, deterministic experiments)
- `test_stage6.py` — Stage 6 tests (scenario presets, application/reset, phased runs, resilience, route history, reproducibility, multi-run, sensitivity, comparison, export)
- `test_workspace.py` — Live workspace regression tests (real packet routes/events, drops, heartbeat rerouting, topology state, SVG motion payload)

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

# Stage 6 — Advanced Network Scenarios & Resilience Evaluation

The Stage 6 layer (`scenarios.py`) makes the engine able to evaluate realistic network situations
**systematically** instead of configuring every experiment by hand.

## 1. Scenario Framework

A scenario is a reproducible description of a network situation. `ScenarioPreset` holds:

| Field | Meaning |
|---|---|
| `name` / `description` | human-readable scenario identity |
| `conditions` | the exact link conditions (congestion, packet loss, bandwidth) applied to named links |
| `failures` | the links and nodes that go down during the run, and are later recovered |
| `workload` | the traffic workload (classes, packets per class, packet size, pps, seed) |
| `seed`, `failure_detection_timeout` | deterministic seed and detection timeout |
| `before_fraction`, `during_fraction` | how much of the workload runs before / during the outage |

`apply_scenario(sim, scenario)` applies a preset to a live simulator (resetting the topology to its
defaults first, so a scenario never inherits the previous one's degradation), and
`reset_scenario(sim)` / `clear_failures(sim)` return the network to its default state.

## 2. Scenario Presets

| Key | Scenario | Conditions | Failures |
|---|---|---|---|
| `normal` | Normal network | none (topology defaults) | — |
| `high_congestion` | High congestion | 75% congestion on all core links | — |
| `high_packet_loss` | High packet loss | 10% loss on all core links | — |
| `reduced_bandwidth` | Reduced bandwidth | 10 Mbps on all core links, bulk (8000 B) packets | — |
| `link_failure` | Link failure | topology defaults | R3-R5 |
| `router_failure` | Router (node) failure | topology defaults | node R3 |
| `multiple_link_failures` | Multiple link failures | topology defaults | R3-R5 and R4-R5 |
| `congestion_and_failure` | Congestion + link failure | 75% congestion | R3-R5 |
| `loss_and_congestion` | Packet loss + congestion | 60% congestion + 12% loss | — |
| `bandwidth_degradation_and_congestion` | Bandwidth degradation + congestion | 15 Mbps + 60% congestion | — |
| `combined_degraded_network` | Combined degraded network | two condition groups: congestion 50% + loss 8% + 20 Mbps, and 50% congestion + 40% loss on R1-R3/R3-R5 | R3-R5 and R4-R5 |

Failures are injected mid-run and recovered later, so every failure scenario produces a real
before / during / after measurement rather than a single snapshot.

## 3. Phased Scenario Execution

`run_scenario(...)` drives the real `NetworkSimulator` through three phases:

1. **before** — the workload runs on the scenario's conditions,
2. **during** — the scenario's components fail, the simulation clock advances past the detection
   timeout so the heartbeat engine *detects, recalculates and reroutes*, and more of the workload
   is processed,
3. **after** — the failed components recover and the remaining workload is drained.

Each phase's metrics are computed by the same `Metrics` implementation used everywhere else, applied
to that phase's packet records, so latency, throughput, loss, PDR and jitter are real per-phase
measurements.

## 4. Resilience Evaluation

For one run the engine records (all measured, never estimated):

- failure time, detection time and detection delay,
- route recalculation time and recalculation delay,
- recovery time and outage time (failure → restored),
- packets processed during the outage ("affected"), delivered and dropped,
- packets successfully delivered after recovery,
- number of route changes, failed components, initial route and final route.

Timing comes from the simulator's `RecoveryRecord`s (the same records Stage 2+3 uses), and the packet
counts come from the packet records created in each phase.

## 5. Route Stability

Every route decision is already logged as structured events, so Stage 6 reconstructs the actual
route history from them:

- `route_history_frame(sim)` — one row per initial route and per `ROUTE_RECALCULATED` event, with the
  previous route, the new route and the route cost.
- `flow_route_history(sim)` — the route history of each individual flow.
- `workload_route_timeline(sim, flow_ids)` — the workload's route over time with repeated routes
  collapsed; the number of route changes is the length of that timeline minus one.

Measured example (`link_failure`, seed 42, 50 packets):

```
Before failure : H1 → R1 → R3 → R5 → H3
During failure : H1 → R1 → R2 → R4 → R5 → H3
After recovery : H1 → R1 → R3 → R5 → H3
```

Detection delay 1.50 s, outage 2.14 s, 2 route changes, 100% of packets delivered.
`multiple_link_failures` (R3-R5 **and** R4-R5 down) detours through
`H1 → R1 → R2 → R4 → R6 → R5 → H3` and returns to the optimal route after recovery.

## 6. Multi-Run Experiments

`run_multi_run_experiment(scenario, seeds=[...])` executes the same scenario with several seeds and
reports, for every metric: **mean, standard deviation, minimum and maximum** (plus the per-run
table). The metrics covered are average latency, latency standard deviation, throughput, packet
loss, PDR, jitter, average queue waiting time, maximum queue length, recovery time, route changes,
successful flows, failed/dropped flows and packets affected.

## 7. Sensitivity Experiment

`run_sensitivity_experiment(parameter, values)` varies **one** network parameter while every other
condition stays identical (the varied parameter is applied uniformly to all links the workload uses,
so routing cannot escape it):

| Parameter | Default sweep |
|---|---|
| `congestion` | 0.0 → 0.2 → 0.4 → 0.6 → 0.8 → 1.0 |
| `packet_loss` | 0 % → 5 % → 10 % → 20 % |
| `bandwidth` | 100 → 50 → 25 → 10 Mbps |

Measured example (mean of seeds 42 and 7, 50 packets), congestion sweep:

| Congestion | Avg latency (ms) | PDR (%) | Throughput (B/s) | Avg queue wait (ms) |
|---|---|---|---|---|
| 0.0 | 541.0 | 100.0 | 29679 | 500.6 |
| 0.2 | 982.3 | 95.0 | 20140 | 896.8 |
| 0.4 | 1424.3 | 88.0 | 14510 | 1293.1 |
| 0.6 | 1846.9 | 82.0 | 11062 | 1689.3 |
| 0.8 | 2292.3 | 79.0 | 9018 | 2085.5 |
| 1.0 | 2759.5 | 76.0 | 7519 | 2481.8 |

## 8. Scenario Comparison

`compare_scenarios([...])` measures several scenarios on the **same workload and the same seed**.
Only the scenario definition differs between rows. Measured example
(50 packets, seed 42):

| Scenario | Avg latency (ms) | PDR (%) | Loss (%) | Outage (s) | Route changes | Final route |
|---|---|---|---|---|---|---|
| Normal network | 541.0 | 100.0 | 0.0 | 0.00 | 0 | H1 → R1 → R3 → R5 → H3 |
| High congestion | 2113.9 | 80.0 | 20.0 | 0.00 | 0 | H1 → R1 → R3 → R5 → H3 |
| Link failure | 1547.0 | 100.0 | 0.0 | 2.14 | 2 | H1 → R1 → R3 → R5 → H3 |
| Combined degraded network | 2838.9 | 40.0 | 60.0 | 3.00 | 2 | H1 → R1 → R3 → R4 → R5 → H3 |

## 9. Reproducibility

Same topology + same conditions + same workload + same seed + same configuration produces the same
simulation result. This is what makes every comparison fair, and it is covered by dedicated tests:
repeating a scenario run returns identical summary rows, phase metrics, route history, route
timeline and per-class tables, and repeating a multi-run experiment with the same seed three times
reports a standard deviation of exactly zero for every metric.

## 10. Export

Every result object exposes `frames() -> {name: DataFrame}`, and
`export_frames(frames, directory)` / `export_result(result, directory)` write those DataFrames to CSV
files. The Scenario Lab additionally offers CSV download buttons for the scenario summary, the route
history, the per-run results, the sensitivity results and the scenario comparison. Exported content
is the generated experiment data, not hand-written values.

---

## Dashboard Tabs (Stage 4 + 5 + 6)

| Tab | Contents |
|---|---|
| **🛰️ Network & Traffic** | Stage 1-3 simulation: traffic generation, fault injection, condition injection, topology view, active route, live metrics, live queue statistics, performance graphs, per-class QoS of the live simulation, event log |
| **🧪 QoS Lab** | Scheduler selection (live + experiment), traffic-class priority/WFQ weight configuration, workload and scenario selection, FIFO vs Priority vs WFQ comparison, congestion stress test, per-class latency/throughput/loss/jitter/waiting-time charts, queue statistics, per-class queue occupancy |
| **🧭 Routing Lab** | Live algorithm selection, routing weight configuration (with presets), Dijkstra vs Bellman-Ford comparison, routing weight sensitivity experiment, route/route-cost/hop-count tables and charts, selected route drawn on the topology, per-class metrics per algorithm |
| **🔬 Combined Lab** | Six-way routing × QoS comparison with six charts (latency, throughput, loss, PDR, jitter, route cost), route/cost/hop table, class-wise comparison across all six configurations, queue statistics per configuration |
| **🧨 Scenario Lab** | Scenario preset selection, full scenario run with per-phase tables/charts and the resilience table, route history + route-over-time chart + final route on the topology, multi-seed repeated experiments with aggregate statistics, parameter sensitivity analysis with charts, scenario comparison, and CSV download buttons |

All experiment runs use deterministic seeds and report the workload, seed and conditions alongside
the results so each comparison is reproducible. The Stage 6 UI is additive only — the existing tabs
were not redesigned.

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
- streamlit>=1.37
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

Expected: 98 tests passed (14 Stage 1 + 22 Stage 2+3 + 23 Stage 4+5 + 34 Stage 6 + 5 interactive workspace).

```bash
pytest test_stage6.py -v      # Stage 6 only
```

## Demonstration Scenario (Required)

This workflow must work through UI:

1. **Open NetAdapt**: `streamlit run app.py`
2. **Observe the live SVG workspace**: PC/router icons, cables, conditions, queue and active route
3. **Configure traffic**: PC1 → PC3, Video, 20 packets, 1500 bytes, 10 packets/sec
4. **Click SEND PACKETS**: queued packets appear at PC1 and automatic playback starts
5. **Use STEP / PLAY / PAUSE / RUN ALL**: every packet follows the route returned by the engine
6. **Inspect a packet/device/link**: click its marker, icon or cable in the workspace
7. **Introduce congestion**: select R1-R3 and apply a high congestion value; cable and route react
8. **Fail R3-R5**: the cable turns red, heartbeat time advances, and the Events panel records failure/detection/recalculation/rerouting
9. **Continue playback**: new packets use the actual recalculated route
10. **Inject loss or change scheduler**: dropped packets show an X; queue occupancy follows the selected scheduler
11. **Switch routing algorithm or weights**: the highlighted route is recalculated by the real router
12. **Recover the link**: the engine records recovery and may return to a cheaper route
13. **Open the lower labs**: QoS, Routing, Combined and Scenario analytics remain available

All steps use real simulation engine, no hardcoded routes or fake metrics.

## Demonstration Scenario (Stage 6 — Scenario Lab)

1. **Open the `🧨 Scenario Lab` tab**
2. **Select a preset**: `High congestion`, `Link failure`, `Multiple link failures`, `Combined degraded network`, …
3. **Press `▶️ Run scenario`**: the workload runs *before* the failure, the failure is injected, the
   clock advances past the detection timeout so the engine detects and reroutes, then the network
   recovers and the rest of the workload is drained
4. **Observe** the per-phase table and chart, the resilience/recovery measurements, the route
   history table, the route-over-time chart and the final route drawn on the topology
5. **Press `🔁 Run repeated experiments`** with seeds `1, 2, 3, 4, 5` to get per-run results plus
   mean / standard deviation / min / max for every metric
6. **Press `📈 Run sensitivity analysis`** and switch the parameter between congestion, packet loss
   and bandwidth to see measured performance degrade monotonically
7. **Press `⚖️ Compare scenarios`** to measure the selected scenarios on the same workload and seed
8. **Download** the summary, route history, per-run, sensitivity or comparison tables as CSV

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
├── app.py                 # Streamlit shell (workspace + preserved labs)
├── network_workspace.py   # Interactive SVG workspace and real packet-step controller
├── scenario_lab.py        # Stage 6 Scenario Lab tab
├── topology.py            # Network topology with positions
├── routing.py             # Dijkstra + Bellman-Ford, configurable weights, route analysis
├── qos.py                 # Packets, FIFO / Priority / WFQ, queue stats, class config
├── metrics.py             # Overall + per-class metrics, jitter, recovery tracking
├── events.py              # Structured event system
├── simulator.py           # Central simulator with self-healing (enhanced)
├── experiments.py         # Stage 4 + 5 experiment engine
├── scenarios.py           # Stage 6 scenario framework + resilience/sensitivity (new)
├── test_simulation.py     # Stage 1 tests
├── test_stage2.py         # Stage 2+3 tests
├── test_stage4_5.py       # Stage 4+5 tests
├── test_stage6.py         # Stage 6 tests
├── test_workspace.py      # Interactive workspace regression tests
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

## Definition of Done — Stage 6 Checklist

- [x] Reusable scenario framework (`ScenarioPreset`, conditions + failures + workload + seed)
- [x] Eleven named scenario presets covering normal, high congestion, high packet loss, reduced
  bandwidth, link failure, router/node failure, multiple link failures, congestion + failure,
  packet loss + congestion, bandwidth degradation + congestion and a combined degraded network
- [x] Scenario presets apply real link conditions and real failures to the simulator
- [x] Scenario reset restores topology defaults and clears failures
- [x] Phased scenario runner: before failure / during failure / after recovery
- [x] Multi-run experiment engine with configurable seeds
- [x] Per scenario: avg latency, latency standard deviation, throughput, packet loss, PDR, jitter,
  average queue waiting time, max queue length, recovery time, route changes, successful and
  failed/dropped flows
- [x] Resilience evaluation: failure time, detection time, route recalculation time, rerouting,
  recovery time, packets affected, packets delivered after recovery, route changes, final route
- [x] Route stability: actual route history per flow + route timeline of the workload
- [x] Sensitivity experiment varying one parameter with all other conditions identical
- [x] Scenario comparison on identical workload and seed
- [x] Reproducibility with deterministic seeds (dedicated tests)
- [x] CSV / DataFrame export of every result
- [x] 34 new Stage 6 tests, all 59 Stage 1-5 tests still passing (93 total)
- [x] Scenario Lab tab in the dashboard (additive only, existing tabs unchanged)
- [x] No fake or hardcoded experiment metrics
- [x] README documents Stage 6

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
- Route recalculation is driven by heartbeat detection, so packets are never routed over a link that
  the routing engine already knows is down; a failure therefore mainly shows up as a route change
  plus the measured detection/recalculation/outage times.
- Route switch-back after recovery uses the engine's hysteresis rule (a recovered route is adopted
  only when it becomes substantially cheaper), so a scenario whose alternative route is only
  marginally worse keeps the alternative path after recovery. Scenarios that force a clearly more
  expensive detour (for example `multiple_link_failures`) do return to the optimal route.
- In the resilience table, "Packets Affected" means the packets processed while the scenario's
  degraded/failure phase was active; for scenarios without failures it is simply the middle phase of
  the workload.
- No authentication/database/cloud (intentionally out of scope)
- The engine models packet loss as one route-level decision, so the drop marker is placed near the
  end of the animated route rather than on a uniquely identified physical loss link.

## License

Educational project for Computer Networks course.
