"""
Comprehensive test suite for NetAdapt Token Bucket Traffic Shaping.

Tests cover:
1. Initial bucket state
2. Token accumulation over simulation time
3. Bucket capacity limits
4. Packet release when sufficient tokens exist
5. Packet waiting when tokens are insufficient
6. Burst behavior
7. Fractional token accumulation
8. Queue limits (drops on queue overflow)
9. Disable and reset behavior (no silent loss or duplication)
10. Invalid configuration validation
11. Packet duplication and loss prevention
12. Integration with FIFO, PQ, and WFQ
13. Integration with adaptive routing
14. Link failure and recovery with traffic shaping
"""

import math
import pytest
from qos import Packet, create_scheduler
from simulator import NetworkSimulator
from topology import NetworkTopology
from routing import AdaptiveRouter
from traffic_shaper import TokenBucketShaper, ShaperStats


def _make_packet(pid: int, src: str = "H1", dst: str = "H3", ttype: str = "HTTP", size: int = 1000, ctime: float = 0.0) -> Packet:
    return Packet(
        packet_id=pid,
        source=src,
        destination=dst,
        traffic_type=ttype,
        size=size,
        creation_time=ctime,
    )


# ==============================================================================
# 1. Initial bucket state
# ==============================================================================
def test_initial_bucket_state():
    shaper = TokenBucketShaper(rate=5.0, capacity=10.0, max_queue_size=20, unit="packets")
    assert shaper.rate == 5.0
    assert shaper.capacity == 10.0
    assert shaper.tokens == 10.0  # Bucket starts full to allow initial burst
    assert shaper.max_queue_size == 20
    assert shaper.unit == "packets"
    assert not shaper.enabled
    assert len(shaper.queue) == 0
    assert shaper.stats.packets_admitted == 0
    assert shaper.stats.packets_released == 0
    assert shaper.stats.packets_delayed == 0
    assert shaper.stats.packets_dropped == 0
    assert shaper.stats.total_shaping_delay == 0.0
    assert shaper.status() == "DISABLED"


# ==============================================================================
# 2. Token accumulation over simulation time
# ==============================================================================
def test_token_accumulation_over_time():
    shaper = TokenBucketShaper(rate=4.0, capacity=10.0, enabled=True)
    shaper.tokens = 0.0  # Empty bucket
    shaper.last_update_time = 0.0

    # Advance time by 0.5s -> 0.5 * 4 = 2 tokens
    shaper.update_tokens(0.5)
    assert shaper.tokens == pytest.approx(2.0)
    assert shaper.last_update_time == 0.5

    # Advance time by another 1.0s -> 2 + 4 = 6 tokens
    shaper.update_tokens(1.5)
    assert shaper.tokens == pytest.approx(6.0)
    assert shaper.last_update_time == 1.5


# ==============================================================================
# 3. Bucket capacity limits
# ==============================================================================
def test_bucket_capacity_limits():
    shaper = TokenBucketShaper(rate=10.0, capacity=5.0, enabled=True)
    shaper.tokens = 3.0
    shaper.last_update_time = 0.0

    # Advance time by 10s: would generate 100 tokens, but capped at 5.0
    shaper.update_tokens(10.0)
    assert shaper.tokens == 5.0
    assert shaper.tokens <= shaper.capacity


# ==============================================================================
# 4. Packet release when sufficient tokens exist
# ==============================================================================
def test_packet_release_when_sufficient_tokens_exist():
    sim = NetworkSimulator()
    shaper = TokenBucketShaper(rate=2.0, capacity=5.0, enabled=True)
    sim.shaper = shaper

    pkt = _make_packet(1, ctime=0.0)
    admitted = shaper.enqueue(pkt, now=0.0, simulator=sim)

    assert admitted is True
    assert shaper.tokens == pytest.approx(4.0)  # 5.0 - 1.0
    assert shaper.stats.packets_released == 1
    assert shaper.stats.packets_delayed == 0
    assert len(shaper.queue) == 0
    assert len(sim.scheduler) == 1
    assert pkt.shaping_delay == 0.0


# ==============================================================================
# 5. Packet waiting when tokens are insufficient
# ==============================================================================
def test_packet_waiting_when_tokens_insufficient():
    sim = NetworkSimulator()
    shaper = TokenBucketShaper(rate=2.0, capacity=1.0, enabled=True)
    sim.shaper = shaper

    # First packet consumes the 1 token
    p1 = _make_packet(1, ctime=0.0)
    shaper.enqueue(p1, now=0.0, simulator=sim)
    assert shaper.tokens == 0.0
    assert len(sim.scheduler) == 1

    # Second packet cannot be released: tokens = 0
    p2 = _make_packet(2, ctime=0.0)
    admitted = shaper.enqueue(p2, now=0.0, simulator=sim)

    assert admitted is True
    assert len(shaper.queue) == 1
    assert shaper.queue[0].packet_id == 2
    assert len(sim.scheduler) == 1  # Not yet in scheduler
    assert shaper.has_waiting_packets()
    assert shaper.status() == "SHAPING"

    # Time advances by 0.5s -> 0.5 * 2 = 1.0 token
    released = shaper.release_waiting(current_time=0.5, simulator=sim)
    assert len(released) == 1
    assert released[0].packet_id == 2
    assert released[0].shaping_delay == pytest.approx(0.5)
    assert len(sim.scheduler) == 2
    assert len(shaper.queue) == 0
    assert shaper.stats.packets_delayed == 1


# ==============================================================================
# 6. Burst behavior
# ==============================================================================
def test_burst_behavior():
    sim = NetworkSimulator()
    # Bucket capacity = 3 packets burst, rate = 1 packet/s
    shaper = TokenBucketShaper(rate=1.0, capacity=3.0, enabled=True)
    sim.shaper = shaper

    # 5 packets arrive simultaneously at t = 0
    packets = [_make_packet(i, ctime=0.0) for i in range(1, 6)]
    for p in packets:
        shaper.enqueue(p, now=0.0, simulator=sim)

    # First 3 packets burst through immediately
    assert shaper.stats.packets_released == 3
    assert len(sim.scheduler) == 3
    assert len(shaper.queue) == 2  # Packets 4 and 5 must wait
    assert shaper.tokens == pytest.approx(0.0)

    # At t = 1.0s, Packet 4 is released
    rel1 = shaper.release_waiting(1.0, sim)
    assert len(rel1) == 1
    assert rel1[0].packet_id == 4
    assert rel1[0].shaping_delay == pytest.approx(1.0)
    assert len(shaper.queue) == 1

    # At t = 2.0s, Packet 5 is released
    rel2 = shaper.release_waiting(2.0, sim)
    assert len(rel2) == 1
    assert rel2[0].packet_id == 5
    assert rel2[0].shaping_delay == pytest.approx(2.0)
    assert len(shaper.queue) == 0


# ==============================================================================
# 7. Fractional token accumulation
# ==============================================================================
def test_fractional_token_accumulation():
    shaper = TokenBucketShaper(rate=2.5, capacity=10.0, enabled=True)
    shaper.tokens = 0.0
    shaper.last_update_time = 0.0

    # Advance by 0.1s -> 0.25 tokens
    shaper.update_tokens(0.1)
    assert shaper.tokens == pytest.approx(0.25)

    # Advance by 0.3s -> 0.25 + 0.75 = 1.0 token
    shaper.update_tokens(0.4)
    assert shaper.tokens == pytest.approx(1.0)


# ==============================================================================
# 8. Queue limits (drops on queue overflow)
# ==============================================================================
def test_queue_limit_enforcement():
    sim = NetworkSimulator()
    # Capacity = 1, Max queue = 2
    shaper = TokenBucketShaper(rate=1.0, capacity=1.0, max_queue_size=2, enabled=True)
    sim.shaper = shaper

    p1 = _make_packet(1)
    p2 = _make_packet(2)
    p3 = _make_packet(3)
    p4 = _make_packet(4)

    # p1 takes token
    assert shaper.enqueue(p1, 0.0, sim) is True
    assert shaper.stats.packets_released == 1

    # p2 fills queue slot 1
    assert shaper.enqueue(p2, 0.0, sim) is True
    assert len(shaper.queue) == 1

    # p3 fills queue slot 2 (queue full now: 2/2)
    assert shaper.enqueue(p3, 0.0, sim) is True
    assert len(shaper.queue) == 2

    # p4 exceeds max_queue_size (2) -> dropped!
    admitted = shaper.enqueue(p4, 0.0, sim)
    assert admitted is False
    assert p4.delivery_status == "DROPPED"
    assert shaper.stats.packets_dropped == 1
    assert len(shaper.queue) == 2


# ==============================================================================
# 9. Disable and reset behavior
# ==============================================================================
def test_disable_flushes_without_silent_loss():
    sim = NetworkSimulator()
    shaper = TokenBucketShaper(rate=1.0, capacity=1.0, enabled=True)
    sim.shaper = shaper

    p1 = _make_packet(1)
    p2 = _make_packet(2)
    p3 = _make_packet(3)

    shaper.enqueue(p1, 0.0, sim)
    shaper.enqueue(p2, 0.0, sim)
    shaper.enqueue(p3, 0.0, sim)
    assert len(shaper.queue) == 2

    # Disabling shaper must flush waiting packets into scheduler safely
    flushed = shaper.disable(sim)
    assert len(flushed) == 2
    assert len(shaper.queue) == 0
    assert not shaper.enabled
    # All 3 packets are now in scheduler without duplication
    assert len(sim.scheduler) == 3
    assert set(p.packet_id for p in sim.scheduler._iter_packets()) == {1, 2, 3}


def test_reset_behavior():
    shaper = TokenBucketShaper(rate=2.0, capacity=5.0, enabled=True)
    shaper.tokens = 0.5
    shaper.queue.append(_make_packet(1))
    shaper.stats.packets_admitted = 10
    shaper.stats.packets_released = 5

    shaper.reset()
    assert shaper.tokens == 5.0
    assert len(shaper.queue) == 0
    assert shaper.stats.packets_admitted == 0
    assert shaper.stats.packets_released == 0
    assert shaper.last_update_time == 0.0


# ==============================================================================
# 10. Invalid configuration validation
# ==============================================================================
def test_invalid_configuration_rejected():
    shaper = TokenBucketShaper()

    with pytest.raises(ValueError, match="positive and finite"):
        shaper.configure(rate=-5.0)

    with pytest.raises(ValueError, match="positive and finite"):
        shaper.configure(rate=0.0)

    with pytest.raises(ValueError, match="positive and finite"):
        shaper.configure(rate=float("nan"))

    with pytest.raises(ValueError, match="positive and finite"):
        shaper.configure(rate=float("inf"))

    with pytest.raises(ValueError, match="maximum supported limit"):
        shaper.configure(rate=2_000_000.0)

    with pytest.raises(ValueError, match="positive and finite"):
        shaper.configure(capacity=-1.0)

    with pytest.raises(ValueError, match="cannot be negative"):
        shaper.configure(max_queue_size=-5)

    with pytest.raises(ValueError, match="Unsupported unit"):
        shaper.configure(unit="gigawatts")


# ==============================================================================
# 11. Packet duplication and loss prevention
# ==============================================================================
def test_no_packet_duplication_or_silent_loss():
    sim = NetworkSimulator()
    sim.configure_shaper(rate=5.0, capacity=5.0, max_queue_size=100, enabled=True)

    # Generate 20 packets
    packets = sim.generate_traffic("H1", "H3", count=20, pps=50.0)
    assert len(packets) == 20

    # Run simulation until empty
    processed = sim.run_until_empty()
    assert len(processed) == 20

    delivered = sum(1 for p in processed if p.delivery_status == "DELIVERED")
    dropped = sum(1 for p in processed if p.delivery_status == "DROPPED")
    assert delivered + dropped == 20
    # Every packet id processed exactly once
    assert len(set(p.packet_id for p in processed)) == 20


# ==============================================================================
# 12. Integration with FIFO, PQ, and WFQ schedulers
# ==============================================================================
def test_shaping_with_priority_queue():
    sim = NetworkSimulator(scheduler="priority")
    sim.configure_shaper(rate=1.0, capacity=3.0, enabled=True)

    # Generate 3 packets with different priorities: FTP (low), Emergency (high), HTTP (med)
    p_ftp = sim.generate_packet("H1", "H3", traffic_type="FTP", creation_time=0.0)
    p_emg = sim.generate_packet("H1", "H3", traffic_type="Emergency", creation_time=0.0)
    p_http = sim.generate_packet("H1", "H3", traffic_type="HTTP", creation_time=0.0)

    # All 3 fit within capacity (3.0) and are admitted into the PriorityQueue
    # When popped, PriorityQueue serves Emergency first, then HTTP, then FTP!
    pop1 = sim.process_next_packet()
    pop2 = sim.process_next_packet()
    pop3 = sim.process_next_packet()

    assert pop1.traffic_type == "Emergency"
    assert pop2.traffic_type == "HTTP"
    assert pop3.traffic_type == "FTP"


def test_shaping_with_wfq():
    sim = NetworkSimulator(scheduler="wfq")
    sim.configure_shaper(rate=10.0, capacity=10.0, enabled=True)

    for _ in range(4):
        sim.generate_packet("H1", "H3", traffic_type="VoIP", creation_time=0.0)
        sim.generate_packet("H1", "H3", traffic_type="FTP", creation_time=0.0)

    processed = sim.run_until_empty()
    assert len(processed) == 8
    assert all(p.delivery_status == "DELIVERED" for p in processed)


# ==============================================================================
# 13. Integration with adaptive routing
# ==============================================================================
def test_shaping_with_adaptive_routing():
    sim = NetworkSimulator(algorithm="dijkstra")
    sim.configure_shaper(rate=2.0, capacity=2.0, enabled=True)

    p1 = sim.generate_packet("H1", "H3", creation_time=0.0)
    p2 = sim.generate_packet("H1", "H3", creation_time=0.0)
    p3 = sim.generate_packet("H1", "H3", creation_time=0.0)

    processed = sim.run_until_empty()
    assert len(processed) == 3
    # Check that route was properly determined by AdaptiveRouter
    assert processed[0].route == ["H1", "R1", "R3", "R5", "H3"]
    assert processed[0].delivery_status == "DELIVERED"
    assert processed[2].shaping_delay > 0.0  # p3 had to wait for tokens


# ==============================================================================
# 14. Link failure and recovery with traffic shaping
# ==============================================================================
def test_shaping_with_link_failure_and_recovery():
    sim = NetworkSimulator()
    sim.configure_shaper(rate=2.0, capacity=2.0, enabled=True)

    # Fail link R3-R5
    sim.fail_link("R3", "R5")

    # Generate 4 packets
    packets = sim.generate_traffic("H1", "H3", count=4, pps=10.0)
    processed = sim.run_until_empty()

    assert len(processed) == 4
    for p in processed:
        assert p.delivery_status == "DELIVERED"
        # Rerouted path must not use the failed link
        assert not any((u, v) in {("R3", "R5"), ("R5", "R3")} for u, v in zip(p.route, p.route[1:]))

    # Recover link
    sim.recover_link("R3", "R5")
    # New packet should use original optimal link
    p_rec = sim.generate_packet("H1", "H3")
    sim.run_until_empty()
    assert ("R3", "R5") in list(zip(p_rec.route, p_rec.route[1:]))


# ==============================================================================
# 15. Sustained rate enforcement over long intervals vs initial burst
# ==============================================================================
def test_sustained_rate_over_long_interval():
    """
    Validates:
    - The permitted initial burst of 5 packets at t=0
    - The sustained rate of 3.0 packets/s across subsequent packets (pkts 6..35)
    - That inter-release interval after burst is exactly 1/rate = 0.3333s
    - Explains why a 10-packet burst has an apparent throughput of ~5.86 pkts/s
      while the sustained throughput over long intervals strictly converges to 3.0 pkts/s.
    """
    sim = NetworkSimulator(seed=42)
    sim.configure_shaper(rate=3.0, capacity=5.0, max_queue_size=100, enabled=True)

    # Generate 35 packets all at time t = 0.0
    for _ in range(35):
        sim.generate_packet("H1", "H3", traffic_type="HTTP", creation_time=0.0)

    releases = []
    while not sim.scheduler.empty() or (sim.shaper.enabled and sim.shaper.has_waiting_packets()):
        sim.shaper.release_waiting(sim.time, sim)
        if sim.scheduler.empty() and sim.shaper.has_waiting_packets():
            next_t = sim.shaper.next_release_time(sim.time)
            sim.time = max(sim.time, next_t)
            sim.shaper.release_waiting(sim.time, sim)
        pkt = sim.scheduler.pop(now=sim.time)
        releases.append((pkt.packet_id, pkt.enqueue_time, pkt.shaping_delay))
        # Advance clock slightly for packet serialization
        sim.time += 0.001

    assert len(releases) == 35

    # 1. First 5 packets: initial burst (admitted immediately at t = 0.0)
    for i in range(5):
        pid, enq, delay = releases[i]
        assert enq == pytest.approx(0.0)
        assert delay == pytest.approx(0.0)

    # 2. Packets 6 to 35: metered at sustained rate 3.0 pkts/s
    sustained_intervals = []
    for i in range(5, len(releases)):
        pid, enq, delay = releases[i]
        prev_enq = releases[i - 1][1]
        interval = enq - prev_enq
        sustained_intervals.append(interval)

    avg_interval = sum(sustained_intervals) / len(sustained_intervals)
    assert avg_interval == pytest.approx(1.0 / 3.0, abs=1e-3)
    sustained_rate = 1.0 / avg_interval
    assert sustained_rate == pytest.approx(3.0, abs=0.05)

    # 3. For the first 10 packets:
    # 5 packets at t=0, 5 packets over 5/3 = 1.667s.
    # Total time = ~1.67s -> 10 / 1.67 = 5.98 pkts/s (accounting for initial burst).
    p10_release = releases[9][1]
    assert p10_release == pytest.approx(5.0 / 3.0, abs=0.01)
    rate_10 = 10.0 / p10_release
    assert rate_10 > 5.5  # High apparent throughput due to initial burst absorption


# ==============================================================================
# 16. Exact shaping delay calculation and aggregate metrics validation
# ==============================================================================
def test_exact_shaping_delay_and_aggregate_metrics():
    """
    Validates:
    - For EVERY packet, shaping_delay == release_time - shaper_enqueued_time.
    - ShaperStats.total_shaping_delay == sum(p.shaping_delay).
    - ShaperStats.average_shaping_delay == mean(p.shaping_delay).
    - ShaperStats.max_shaping_delay == max(p.shaping_delay).
    """
    sim = NetworkSimulator(seed=101)
    sim.configure_shaper(rate=4.0, capacity=2.0, max_queue_size=50, enabled=True)

    # Stagger packet arrivals
    packets = []
    for i in range(12):
        t = i * 0.1
        sim.time = t
        p = sim.generate_packet("H1", "H3", creation_time=t)
        packets.append(p)

    processed = sim.run_until_empty()
    assert len(processed) == 12

    delays = []
    for p in processed:
        release_time = p.enqueue_time
        enq_time = p.shaper_enqueued_time
        assert enq_time is not None
        assert release_time is not None
        expected_delay = max(0.0, release_time - enq_time)
        assert p.shaping_delay == pytest.approx(expected_delay, abs=1e-6)
        delays.append(p.shaping_delay)

    stats = sim.shaper.stats
    expected_total = sum(delays)
    expected_avg = expected_total / len(delays)
    expected_max = max(delays)

    assert stats.total_shaping_delay == pytest.approx(expected_total, abs=1e-6)
    assert stats.average_shaping_delay == pytest.approx(expected_avg, abs=1e-6)
    assert stats.max_shaping_delay == pytest.approx(expected_max, abs=1e-6)

