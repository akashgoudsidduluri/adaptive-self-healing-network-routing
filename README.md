# NetAdapt — Adaptive and Self-Healing QoS-Based Network Routing System

> An interactive Computer Networks simulation system that dynamically selects routes based on network conditions, detects failures, reroutes traffic automatically, applies QoS scheduling, and analyzes network performance.

## Project Status

**Planning / Development Phase**

The system is currently being designed and implemented in phases. This README describes the planned architecture, workflow, features, and implementation roadmap.

---

## 1. Overview

Modern computer networks operate under continuously changing conditions. Traffic levels can increase, links can become congested, packet loss can occur, bandwidth can decrease, and routers or communication links can fail.

Traditional shortest-path routing may continue using a route even when its current conditions are poor.

**NetAdapt** is designed as an interactive network simulator that demonstrates how a network can adapt to these changes.

The system will:

- Monitor network conditions
- Select routes dynamically
- Detect link and node failures
- Automatically calculate alternative routes
- Redirect traffic after failures
- Simulate congestion and packet loss
- Apply Quality of Service (QoS) scheduling
- Measure network performance
- Visualize routing and recovery behavior interactively

This is a **simulation-based Computer Networks project**, not a replacement for real production routing protocols.

---

# 2. Problem Statement

Computer networks experience changing conditions such as congestion, packet loss, latency variation, bandwidth limitations, and link or node failures.

If traffic continues to use the same route without considering these conditions, network performance can degrade, resulting in increased delay, packet loss, and reduced throughput.

This project aims to develop an interactive network simulation system that monitors network conditions, dynamically selects suitable routes, detects failures, automatically redirects traffic through available paths, and prioritizes important traffic using QoS techniques.

The system will evaluate network behavior using measurable performance parameters such as latency, throughput, packet loss, packet delivery ratio, congestion, and recovery time.

---

# 3. Objectives

The main objectives of NetAdapt are:

1. Build a realistic simulated computer network.
2. Implement dynamic, condition-aware routing.
3. Detect simulated link and router failures.
4. Automatically recover from failures using alternative paths.
5. Simulate different traffic conditions.
6. Implement QoS-based packet scheduling.
7. Compare FIFO, Priority Queue, and Weighted Fair Queuing.
8. Measure network performance using actual simulated packets.
9. Visualize topology, routes, failures, and performance.
10. Provide an interactive environment for experimenting with network behavior.

---

# 4. Key Features

### Adaptive Routing

Routes are selected according to current network conditions rather than relying only on hop count.

The routing cost will consider factors such as:

- Latency
- Packet loss
- Congestion
- Bandwidth
- Hop count

Conceptually:

```text
Route Cost =
    α × Latency
  + β × Packet Loss
  + γ × Congestion
  + δ × Bandwidth Cost
  + ε × Hop Count