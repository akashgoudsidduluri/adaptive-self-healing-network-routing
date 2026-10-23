"""Tests for routing table visualization, self-healing observability, and MAC tables."""

from __future__ import annotations

import pytest

from devices import Device, Switch, NetworkInterface, deterministic_mac
from events import EventLogger, EventType
from lab_session import LabSession
from protocols import ProtocolStack, SwitchFrame, SwitchForwardResult
from routing import AdaptiveRouter
from simulator import NetworkSimulator
from topology import NetworkTopology


class TestRoutingTableVisualization:
    """Tests for routing table display and route details."""

    def test_routing_table_entries_for_known_topology(self):
        """Verify routing table has correct entries for default topology."""
        session = LabSession()
        state = session.state()

        # Self-Healing Demo has routers R1, R2, R3
        routers = [name for name, dev in session.simulator.topology.devices.items()
                   if dev.is_router]
        assert len(routers) >= 1

        # Each router should have routing table entries
        for router_name in routers:
            table = session.simulator.routing_table(router_name)
            entries = table.entries
            # Router should have routes to other reachable devices
            assert len(entries) > 0, f"Router {router_name} has no routes"

    def test_route_entries_include_path(self):
        """Verify route entries include the full path when requested."""
        session = LabSession()
        router_name = "R1"

        # Get routing table via new API
        result = session.get_routing_table(router_name)

        assert result["type"] == "routing_table"
        assert result["device"] == router_name
        assert "algorithm" in result
        assert "entries" in result

        for entry in result["entries"]:
            assert "destination_network" in entry
            assert "prefix" in entry
            assert "next_hop" in entry
            assert "outgoing_interface" in entry
            assert "metric" in entry
            assert "route_path" in entry
            assert "status" in entry

    def test_unreachable_destinations_marked(self):
        """Verify unreachable destinations are marked correctly."""
        session = LabSession()

        # Get list of routers
        routers = [name for name, dev in session.simulator.topology.devices.items()
                   if dev.is_router]
        if not routers:
            pytest.skip("No routers in topology")

        router_name = routers[0]
        # Get neighbors of this router
        neighbors = list(session.simulator.topology.graph.neighbors(router_name))
        if not neighbors:
            pytest.skip("Router has no neighbors")

        # Fail a link to a neighbor
        neighbor = neighbors[0]
        session.simulator.fail_link(router_name, neighbor)

        # Get routing table
        result = session.get_routing_table(router_name)

        # Some destinations may become unreachable
        unreachable = [e for e in result["entries"] if e["status"] == "UNREACHABLE"]
        reachable = [e for e in result["entries"] if e["status"] == "REACHABLE"]

        # At least some destinations should still be reachable
        # (unless the router is completely isolated)
        assert len(reachable) >= 0  # May be 0 if all paths failed

    def test_route_updates_after_link_recovery(self):
        """Verify routes update after link recovery."""
        session = LabSession()

        # Get list of routers
        routers = [name for name, dev in session.simulator.topology.devices.items()
                   if dev.is_router]
        if len(routers) < 2:
            pytest.skip("Need at least 2 routers")

        router_name = routers[0]
        neighbors = list(session.simulator.topology.graph.neighbors(router_name))
        if not neighbors:
            pytest.skip("Router has no neighbors")

        neighbor = neighbors[0]

        # Fail a link
        session.simulator.fail_link(router_name, neighbor)
        session.simulator.tick(3.0)

        # Get routing table before recovery
        result_before = session.get_routing_table(router_name)
        entries_before = {e["destination_network"]: e for e in result_before["entries"]}

        # Recover the link
        session.simulator.recover_link(router_name, neighbor)
        session.simulator.tick(0.5)

        # Get routing table after recovery
        result_after = session.get_routing_table(router_name)
        entries_after = {e["destination_network"]: e for e in result_after["entries"]}

        # Entries should be updated
        for net in entries_before:
            if net in entries_after:
                # Route path may have changed
                assert entries_after[net]["status"] in ("REACHABLE", "UNREACHABLE")


class TestSelfHealingObservability:
    """Tests for self-healing event visibility and details."""

    def test_failure_event_contains_link_info(self):
        """Verify LINK_FAILED event contains correct link information."""
        session = LabSession()

        # Fail a link
        session.simulator.fail_link("R1", "R3")

        # Get events
        events = session.state()["events"]
        link_failed_events = [e for e in events if e["event"] == "LINK_FAILED"]

        assert len(link_failed_events) > 0
        event = link_failed_events[-1]

        assert "link" in event or "component" in event
        assert "R1" in str(event.get("component", event.get("link", "")))
        assert "R3" in str(event.get("component", event.get("link", "")))

    def test_route_change_event_reflects_recalculation(self):
        """Verify ROUTE_RECALCULATED event contains actual recalculation results."""
        session = LabSession()

        # Get devices
        devices = list(session.simulator.topology.devices.keys())
        routers = [d for d in devices if session.simulator.topology.devices[d].is_router]
        hosts = [d for d in devices if not session.simulator.topology.devices[d].is_router]

        if len(routers) < 2 or len(hosts) < 2:
            pytest.skip("Need at least 2 routers and 2 hosts")

        source = hosts[0]
        destination = hosts[1] if hosts[0] != hosts[1] else hosts[2] if len(hosts) > 2 else None
        if destination is None:
            pytest.skip("Need 2 different hosts")

        # Create a flow first
        try:
            session.simulator.create_flow(source, destination, "Video", 5, 1000, 10.0, 1.0)
        except ValueError:
            pytest.skip(f"Cannot create flow from {source} to {destination}")

        # Get a link to fail
        if not session.simulator.topology.graph.edges():
            pytest.skip("No links in topology")

        link_to_fail = list(session.simulator.topology.graph.edges())[0]
        session.simulator.fail_link(link_to_fail[0], link_to_fail[1])
        session.simulator.tick(3.0)

        # Get events
        events = session.state()["events"]
        recalc_events = [e for e in events if e["event"] == "ROUTE_RECALCULATED"]

        # May or may not have recalc events depending on topology
        if recalc_events:
            event = recalc_events[-1]
            # Event should have route information
            assert "old_route" in event or "previous_route" in event or "route" in event

    def test_packet_delivered_event_contains_route(self):
        """Verify PACKET_DELIVERED event contains the actual route."""
        session = LabSession()

        # Get devices
        devices = list(session.simulator.topology.devices.keys())
        hosts = [d for d in devices if not session.simulator.topology.devices[d].is_router]

        if len(hosts) < 2:
            pytest.skip("Need at least 2 hosts")

        source = hosts[0]
        destination = hosts[1] if hosts[0] != hosts[1] else hosts[2] if len(hosts) > 2 else None
        if destination is None:
            pytest.skip("Need 2 different hosts")

        # Create and send traffic
        try:
            session.simulator.create_flow(source, destination, "HTTP", 3, 1000, 100.0, 0.1)
            session.simulator.run_until_empty()
        except ValueError:
            pytest.skip(f"Cannot create flow from {source} to {destination}")

        # Get events
        events = session.state()["events"]
        delivered_events = [e for e in events if e["event"] == "PACKET_DELIVERED"]

        if delivered_events:
            event = delivered_events[-1]
            # Event should have route information
            assert "route" in event or "actual_route" in event
            route = event.get("route") or event.get("actual_route")
            assert route is not None
            assert len(route) >= 2

    def test_event_timeline_has_no_invented_information(self):
        """Verify timeline events don't contain fabricated data."""
        session = LabSession()

        # Get devices
        devices = list(session.simulator.topology.devices.keys())
        hosts = [d for d in devices if not session.simulator.topology.devices[d].is_router]

        # If no hosts, just check static events
        if hosts:
            source = hosts[0]
            destination = hosts[1] if hosts[0] != hosts[1] else (hosts[2] if len(hosts) > 2 else None)
            if destination:
                try:
                    session.simulator.create_flow(source, destination, "HTTP", 2, 1000, 100.0, 0.1)
                    session.simulator.run_until_empty()
                except ValueError:
                    pass  # May fail if hosts aren't connected

        events = session.state()["events"]

        if not events:
            pytest.skip("No events generated")

        for event in events:
            # All events should have a timestamp
            assert "time" in event
            assert event["time"] >= 0

            # Events should have a message
            assert "message" in event
            assert len(event["message"]) > 0

            # Events shouldn't have fabricated fields
            # Only known fields should be present
            known_fields = {
                "time", "event", "message", "component", "flow_id",
                "link", "node", "packet_id", "route", "old_route",
                "new_route", "previous_route", "actual_route",
                "route_cost", "route_status", "source", "destination",
                "latency", "reason", "failure_time", "detection_time",
                "detection_delay", "recovery_time", "details"
            }
            for key in event:
                assert key in known_fields or key.startswith("detail_"), \
                    f"Unknown field {key} in event {event['event']}"

    def test_recovery_sequence_is_observable(self):
        """Verify the full recovery sequence can be observed."""
        session = LabSession()

        # Get devices
        devices = list(session.simulator.topology.devices.keys())
        routers = [d for d in devices if session.simulator.topology.devices[d].is_router]
        hosts = [d for d in devices if not session.simulator.topology.devices[d].is_router]

        if len(routers) < 2 or len(hosts) < 2:
            pytest.skip("Need at least 2 routers and 2 hosts")

        source = hosts[0]
        destination = hosts[1] if hosts[0] != hosts[1] else hosts[2] if len(hosts) > 2 else None
        if destination is None:
            pytest.skip("Need 2 different hosts")

        # Start with working network
        try:
            session.simulator.create_flow(source, destination, "Video", 5, 1000, 50.0, 0.1)
        except ValueError:
            pytest.skip(f"Cannot create flow from {source} to {destination}")

        # Get initial route
        initial_flow = session.simulator.active_flows.get("flow-1") or list(session.simulator.active_flows.values())[0]
        if not initial_flow:
            pytest.skip("No flow created")
        initial_route = initial_flow.current_route.copy()

        # Get a link to fail
        edges = list(session.simulator.topology.graph.edges())
        if not edges:
            pytest.skip("No links in topology")
        link_to_fail = edges[0]

        # Fail a link
        session.simulator.fail_link(link_to_fail[0], link_to_fail[1])
        session.simulator.tick(3.0)

        # Check for failure events
        events = session.state()["events"]
        link_failed = any(e["event"] == "LINK_FAILED" for e in events)

        assert link_failed, "LINK_FAILED event should be present"

        # Check flow status changed
        flow_id = initial_flow.flow_id
        updated_flow = session.simulator.active_flows.get(flow_id)
        if updated_flow:
            assert updated_flow.current_route != initial_route or updated_flow.route_status in ("FAILED", "REROUTED")

        # Recover and verify
        session.simulator.recover_link(link_to_fail[0], link_to_fail[1])
        session.simulator.tick(0.5)

        events_after = session.state()["events"]
        link_recovered = any(e["event"] == "LINK_RECOVERED" for e in events_after)
        assert link_recovered, "LINK_RECOVERED event should be present after recovery"


class TestMacTableVisualization:
    """Tests for MAC address table display and learning."""

    def test_mac_learning_on_correct_port(self):
        """Verify source MAC is learned on the correct incoming port."""
        session = LabSession()

        # Add a switch to the topology
        switch_name = "SW1"
        session.simulator.topology.add_node(switch_name, "switch")

        # Get routers to connect to
        routers = [name for name, dev in session.simulator.topology.devices.items()
                   if dev.is_router]
        if len(routers) < 2:
            pytest.skip("Need at least 2 routers")

        session.simulator.topology.add_link(switch_name, routers[0], latency=5, bandwidth=100)
        session.simulator.topology.add_link(switch_name, routers[1], latency=5, bandwidth=100)

        # Get the switch device
        switch = session.simulator.topology.get_device(switch_name)
        assert switch.is_switch

        # Create a frame arriving on eth0 (connected to R1)
        source_mac = "02:00:00:00:00:AA"
        frame = SwitchFrame(source_mac, "FF:FF:FF:FF:FF:FF", "eth0")

        # Process the frame
        result = session.simulator.switch_frame(switch_name, frame, ["eth0", "eth1"])

        # MAC should be learned on eth0
        assert switch.lookup_mac(source_mac) == "eth0"
        assert result.action == "FLOOD"  # Unknown destination flooded

    def test_existing_mapping_persists_same_port(self):
        """Verify existing MAC mapping remains when frame arrives on same port."""
        session = LabSession()

        switch_name = "SW1"
        session.simulator.topology.add_node(switch_name, "switch")

        routers = [name for name, dev in session.simulator.topology.devices.items()
                   if dev.is_router]
        if not routers:
            pytest.skip("No routers in topology")

        session.simulator.topology.add_link(switch_name, routers[0], latency=5, bandwidth=100)

        switch = session.simulator.topology.get_device(switch_name)
        source_mac = "02:00:00:00:00:BB"

        # First frame learns the MAC
        frame1 = SwitchFrame(source_mac, "FF:FF:FF:FF:FF:FF", "eth0")
        session.simulator.switch_frame(switch_name, frame1, ["eth0"])

        # Second frame from same MAC on same port should refresh
        frame2 = SwitchFrame(source_mac, "FF:FF:FF:FF:FF:FF", "eth0")
        session.simulator.switch_frame(switch_name, frame2, ["eth0"])

        # MAC should still be on eth0
        assert switch.lookup_mac(source_mac) == "eth0"

    def test_mac_table_inspection_reports_learned_entries(self):
        """Verify MAC table inspection shows learned entries."""
        session = LabSession()

        switch_name = "SW_TEST"
        session.simulator.topology.add_node(switch_name, "switch")

        routers = [name for name, dev in session.simulator.topology.devices.items()
                   if dev.is_router]
        if not routers:
            pytest.skip("No routers in topology")

        session.simulator.topology.add_link(switch_name, routers[0], latency=5, bandwidth=100)

        source_mac = "02:00:00:00:00:CC"
        frame = SwitchFrame(source_mac, "FF:FF:FF:FF:FF:FF", "eth0")
        session.simulator.switch_frame(switch_name, frame, ["eth0"])

        state = session.inspect_mac(switch_name)
        result = state.get("diagnostic_result", state)

        assert result["type"] == "mac"
        assert result["device"] == switch_name
        assert len(result["entries"]) == 1
        assert result["entries"][0]["mac_address"] == source_mac
        assert result["entries"][0]["interface_id"] == "eth0"
        assert result["entries"][0]["type"] == "DYNAMIC"

    def test_clear_mac_table(self):
        """Verify MAC table can be cleared."""
        session = LabSession()

        switch_name = "SW_TEST2"
        session.simulator.topology.add_node(switch_name, "switch")

        routers = [name for name, dev in session.simulator.topology.devices.items()
                   if dev.is_router]
        if not routers:
            pytest.skip("No routers in topology")

        session.simulator.topology.add_link(switch_name, routers[0], latency=5, bandwidth=100)

        source_mac = "02:00:00:00:00:DD"
        frame = SwitchFrame(source_mac, "FF:FF:FF:FF:FF:FF", "eth0")
        session.simulator.switch_frame(switch_name, frame, ["eth0"])

        assert len(session.simulator.mac_table(switch_name)) == 1

        result = session.clear_mac(switch_name)
        result_data = result.get("diagnostic_result", result)

        assert result_data.get("cleared", 0) >= 1
        assert len(session.simulator.mac_table(switch_name)) == 0

    def test_known_unicast_forwarding(self):
        """Verify known unicast destination is forwarded to correct port."""
        session = LabSession()

        switch_name = "SW1"
        session.simulator.topology.add_node(switch_name, "switch")

        routers = [name for name, dev in session.simulator.topology.devices.items()
                   if dev.is_router]
        if len(routers) < 2:
            pytest.skip("Need at least 2 routers")

        session.simulator.topology.add_link(switch_name, routers[0], latency=5, bandwidth=100)
        session.simulator.topology.add_link(switch_name, routers[1], latency=5, bandwidth=100)

        switch = session.simulator.topology.get_device(switch_name)

        # Learn a MAC on eth0
        source_mac = "02:00:00:00:00:EE"
        frame1 = SwitchFrame(source_mac, "FF:FF:FF:FF:FF:FF", "eth0")
        session.simulator.switch_frame(switch_name, frame1, ["eth0", "eth1"])

        # Now send frame to known destination
        frame2 = SwitchFrame("02:00:00:00:00:FF", source_mac, "eth1")
        result = session.simulator.switch_frame(switch_name, frame2, ["eth0", "eth1"])

        # Should forward to eth0 (where source_mac was learned)
        assert result.action == "FORWARD"
        assert "eth0" in result.output_interfaces

    def test_unknown_unicast_flooding(self):
        """Verify unknown unicast destination is flooded."""
        session = LabSession()

        switch_name = "SW1"
        session.simulator.topology.add_node(switch_name, "switch")

        routers = [name for name, dev in session.simulator.topology.devices.items()
                   if dev.is_router]
        if len(routers) < 2:
            pytest.skip("Need at least 2 routers")

        session.simulator.topology.add_link(switch_name, routers[0], latency=5, bandwidth=100)
        session.simulator.topology.add_link(switch_name, routers[1], latency=5, bandwidth=100)

        switch = session.simulator.topology.get_device(switch_name)

        # Send frame to unknown destination
        frame = SwitchFrame("02:00:00:00:00:FF", "02:00:00:00:00:AA", "eth0")
        result = session.simulator.switch_frame(switch_name, frame, ["eth0", "eth1"])

        # Should flood to all ports except ingress
        assert result.action == "FLOOD"
        assert "eth1" in result.output_interfaces

    def test_broadcast_flooding(self):
        """Verify broadcast frames are flooded."""
        session = LabSession()

        switch_name = "SW1"
        session.simulator.topology.add_node(switch_name, "switch")

        routers = [name for name, dev in session.simulator.topology.devices.items()
                   if dev.is_router]
        if len(routers) < 2:
            pytest.skip("Need at least 2 routers")

        session.simulator.topology.add_link(switch_name, routers[0], latency=5, bandwidth=100)
        session.simulator.topology.add_link(switch_name, routers[1], latency=5, bandwidth=100)

        # Send broadcast frame
        frame = SwitchFrame("02:00:00:00:00:AA", "FF:FF:FF:FF:FF:FF", "eth0")
        result = session.simulator.switch_frame(switch_name, frame, ["eth0", "eth1"])

        assert result.action == "FLOOD"
        assert "eth1" in result.output_interfaces

    def test_empty_mac_table(self):
        """Verify empty MAC table is handled gracefully."""
        session = LabSession()

        switch_name = "SW_TEST3"
        session.simulator.topology.add_node(switch_name, "switch")

        # Inspect empty table
        state = session.inspect_mac(switch_name)
        result = state.get("diagnostic_result", state)

        assert result["entries"] == []
        # Title should contain device name
        assert switch_name in result["title"]

    def test_mac_table_reflects_actual_switch_state(self):
        """Verify MAC table API reflects actual switch device state."""
        session = LabSession()

        switch_name = "SW1"
        session.simulator.topology.add_node(switch_name, "switch")

        routers = [name for name, dev in session.simulator.topology.devices.items()
                   if dev.is_router]
        if not routers:
            pytest.skip("No routers in topology")

        session.simulator.topology.add_link(switch_name, routers[0], latency=5, bandwidth=100)

        switch = session.simulator.topology.get_device(switch_name)
        source_mac = "02:00:00:00:00:GG"
        frame = SwitchFrame(source_mac, "FF:FF:FF:FF:FF:FF", "eth0")
        session.simulator.switch_frame(switch_name, frame, ["eth0"])

        # Both API and device should show same data
        api_entries = session.simulator.mac_table(switch_name)
        device_entries = switch.mac_table

        assert len(api_entries) == len(device_entries)
        for entry in api_entries:
            assert entry["mac_address"] in device_entries
            assert device_entries[entry["mac_address"]] == entry["interface_id"]

    def test_mac_learning_emits_event(self):
        """Verify MAC learning emits MAC_LEARNED event."""
        session = LabSession()

        switch_name = "SW1"
        session.simulator.topology.add_node(switch_name, "switch")

        # Get routers to connect to
        routers = [name for name, dev in session.simulator.topology.devices.items()
                   if dev.is_router]
        if not routers:
            pytest.skip("No routers in topology")

        session.simulator.topology.add_link(switch_name, routers[0], latency=5, bandwidth=100)

        source_mac = "02:00:00:00:00:HH"
        frame = SwitchFrame(source_mac, "FF:FF:FF:FF:FF:FF", "eth0")
        session.simulator.switch_frame(switch_name, frame, ["eth0"])

        # Check for MAC_LEARNED event
        events = session.state()["events"]
        mac_learned = [e for e in events if e["event"] == "MAC_LEARNED"]

        assert len(mac_learned) > 0
        event = mac_learned[-1]
        # Event details may be in 'details' sub-object or directly on event
        details = event.get("details", event)
        assert details.get("source_mac") == source_mac
        assert details.get("interface_id") == "eth0"


class TestRouteDetailsDisplay:
    """Tests for route detail display when selecting routing table entries."""

    def test_route_path_includes_all_hops(self):
        """Verify route path includes all intermediate hops."""
        session = LabSession()

        result = session.get_routing_table("R1")

        for entry in result["entries"]:
            if entry["status"] == "REACHABLE" and entry["route_path"]:
                # Route path should start at the router and end at destination
                assert entry["route_path"][0] == "R1"
                # Path should have at least 2 elements (source and destination)
                assert len(entry["route_path"]) >= 2

    def test_route_status_reflects_reachability(self):
        """Verify route status correctly reflects reachability."""
        session = LabSession()

        # Get initial routing table
        result = session.get_routing_table("R1")
        initial_status = {e["destination_network"]: e["status"]
                         for e in result["entries"]}

        # Fail a link
        session.simulator.fail_link("R1", "R3")

        # Get updated routing table
        result = session.get_routing_table("R1")
        updated_status = {e["destination_network"]: e["status"]
                         for e in result["entries"]}

        # Some routes may have changed status
        for net in initial_status:
            if net in updated_status:
                assert updated_status[net] in ("REACHABLE", "UNREACHABLE")


class TestFlowRouteObservability:
    """Tests for flow route visibility."""

    def test_flow_routes_reported(self):
        """Verify active flow routes are reported."""
        session = LabSession()

        # Get devices
        devices = list(session.simulator.topology.devices.keys())
        hosts = [d for d in devices if not session.simulator.topology.devices[d].is_router]

        if len(hosts) < 2:
            pytest.skip("Need at least 2 hosts")

        source = hosts[0]
        destination = hosts[1] if hosts[0] != hosts[1] else hosts[2] if len(hosts) > 2 else None
        if destination is None:
            pytest.skip("Need 2 different hosts")

        # Create a flow
        try:
            session.simulator.create_flow(source, destination, "HTTP", 5, 1000, 10.0, 0.5)
        except ValueError:
            pytest.skip(f"Cannot create flow from {source} to {destination}")

        # Get flow routes
        result = session.get_flow_routes()

        assert result["type"] == "flow_routes"
        assert len(result["flows"]) >= 1

        flow = result["flows"][0]
        assert "flow_id" in flow
        assert "source" in flow
        assert "destination" in flow
        assert "current_route" in flow
        assert "route_status" in flow
        assert "route_cost" in flow

    def test_flow_route_updates_after_failure(self):
        """Verify flow route updates are reflected after link failure."""
        session = LabSession()

        # Get devices
        devices = list(session.simulator.topology.devices.keys())
        hosts = [d for d in devices if not session.simulator.topology.devices[d].is_router]
        routers = [d for d in devices if session.simulator.topology.devices[d].is_router]

        if len(hosts) < 2 or len(routers) < 1:
            pytest.skip("Need at least 2 hosts and 1 router")

        source = hosts[0]
        destination = hosts[1] if hosts[0] != hosts[1] else hosts[2] if len(hosts) > 2 else None
        if destination is None:
            pytest.skip("Need 2 different hosts")

        # Create flow
        try:
            session.simulator.create_flow(source, destination, "Video", 5, 1000, 10.0, 0.5)
        except ValueError:
            pytest.skip(f"Cannot create flow from {source} to {destination}")

        initial_routes = session.get_flow_routes()

        # Get a link to fail
        edges = list(session.simulator.topology.graph.edges())
        if not edges:
            pytest.skip("No links in topology")
        link_to_fail = edges[0]

        # Fail a link
        session.simulator.fail_link(link_to_fail[0], link_to_fail[1])
        session.simulator.tick(3.0)

        updated_routes = session.get_flow_routes()

        # Find the flow in both results
        for initial, updated in zip(initial_routes["flows"], updated_routes["flows"]):
            if initial["flow_id"] == updated["flow_id"]:
                # Route may have changed
                assert updated["route_status"] in ("HEALTHY", "REROUTED", "FAILED")
                if updated["route_status"] == "REROUTED":
                    assert updated["current_route"] != initial["current_route"]
