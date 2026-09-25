"""
NetAdapt — Adaptive and Self-Healing QoS-Based Network Routing System
Interactive Streamlit dashboard for Stage 2+3
"""

import streamlit as st
import plotly.graph_objects as go
import pandas as pd
from typing import List, Tuple

from simulator import NetworkSimulator
from qos import PRIORITIES


st.set_page_config(
    page_title="NetAdapt",
    page_icon="🌐",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ------------------------------------------------------------------
# Session State Initialization
# ------------------------------------------------------------------
if "simulator" not in st.session_state:
    st.session_state.simulator = NetworkSimulator(seed=42, heartbeat_interval=1.0, failure_detection_timeout=2.0)

if "selected_source" not in st.session_state:
    st.session_state.selected_source = "H1"
if "selected_dest" not in st.session_state:
    st.session_state.selected_dest = "H3"
if "selected_flow_id" not in st.session_state:
    st.session_state.selected_flow_id = None
if "auto_rerun" not in st.session_state:
    st.session_state.auto_rerun = False

sim: NetworkSimulator = st.session_state.simulator

# ------------------------------------------------------------------
# Helper functions
# ------------------------------------------------------------------
def get_topology_figure(simulator: NetworkSimulator, highlight_route: List[str] | None = None):
    """Create Plotly figure for network topology."""
    pos = simulator.topology.get_positions()
    G = simulator.topology.graph

    edge_x = []
    edge_y = []
    edge_colors = []
    edge_widths = []
    edge_texts = []

    # Determine highlight edges set for quick lookup
    highlight_edges = set()
    if highlight_route and len(highlight_route) >= 2:
        for a, b in zip(highlight_route, highlight_route[1:]):
            highlight_edges.add(tuple(sorted((a, b))))

    # Collect all edges
    for u, v, data in G.edges(data=True):
        x0, y0 = pos.get(u, (0, 0))
        x1, y1 = pos.get(v, (0, 0))

        is_active = simulator.topology.active_link(u, v)
        key = tuple(sorted((u, v)))
        is_failed = key in simulator._failed_links
        is_highlight = key in highlight_edges

        # Edge styling
        if is_failed:
            color = "red"
            width = 4
            dash = "dash"
        elif is_highlight:
            color = "#00CC96"  # green for active route
            width = 5
            dash = "solid"
        elif not is_active:
            color = "gray"
            width = 2
            dash = "dot"
        else:
            # Color based on congestion
            congestion = data.get("congestion", 0.0)
            if congestion > 0.7:
                color = "orange"
                width = 3 + congestion * 2
            elif congestion > 0.3:
                color = "#FFA15A"
                width = 2 + congestion * 2
            else:
                color = "#636EFA"
                width = 2
            dash = "solid"

        # For Plotly we need to add None separator
        edge_x.extend([x0, x1, None])
        edge_y.extend([y0, y1, None])

        # We'll create separate traces for styling, so collect info
        edge_colors.append((color, width, dash, u, v, data, is_failed, is_highlight))

    # Create figure
    fig = go.Figure()

    # Draw edges individually to allow different styles
    for color, width, dash, u, v, data, is_failed, is_highlight in edge_colors:
        x0, y0 = pos.get(u, (0, 0))
        x1, y1 = pos.get(v, (0, 0))
        status = "DOWN" if is_failed else data.get("status", "UP")
        hover = (
            f"{u} ↔ {v}<br>"
            f"Status: {status}<br>"
            f"Latency: {data.get('latency', 0)} ms<br>"
            f"Bandwidth: {data.get('bandwidth', 0)} Mbps<br>"
            f"Loss: {data.get('packet_loss', 0):.2%}<br>"
            f"Congestion: {data.get('congestion', 0):.2%}"
        )
        if is_highlight:
            hover += "<br><b>ACTIVE ROUTE</b>"

        fig.add_trace(
            go.Scatter(
                x=[x0, x1],
                y=[y0, y1],
                mode="lines",
                line=dict(color=color, width=width, dash=dash),
                hoverinfo="text",
                hovertext=hover,
                showlegend=False,
            )
        )

    # Nodes
    host_x, host_y, host_text, host_color, host_size, host_border = [], [], [], [], [], []
    router_x, router_y, router_text, router_color, router_size, router_border = [], [], [], [], [], []

    for node, data in G.nodes(data=True):
        x, y = pos.get(node, (0, 0))
        node_type = data.get("type", "router")
        status = data.get("status", "UP")
        is_failed = not simulator.topology.active_node(node)

        hover = f"{node} ({node_type})<br>Status: {status}"
        if is_failed:
            hover += "<br><b>FAILED</b>"

        if node_type == "host":
            host_x.append(x)
            host_y.append(y)
            host_text.append(f"{node}<br>{hover}")
            host_color.append("red" if is_failed else "#19D3F3")
            host_size.append(28)
            host_border.append("red" if is_failed else "black")
        else:
            router_x.append(x)
            router_y.append(y)
            router_text.append(f"{node}<br>{hover}")
            router_color.append("red" if is_failed else "#FF6692" if node in (highlight_route or []) else "#AB63FA")
            router_size.append(32 if node in (highlight_route or []) else 26)
            router_border.append("red" if is_failed else "black")

    # Hosts trace
    fig.add_trace(
        go.Scatter(
            x=host_x,
            y=host_y,
            mode="markers+text",
            marker=dict(
                size=host_size,
                color=host_color,
                line=dict(width=2, color=host_border),
                symbol="square",
            ),
            text=[n for n in G.nodes if G.nodes[n].get("type") == "host"],
            textposition="top center",
            textfont=dict(size=12, color="black"),
            hovertext=host_text,
            hoverinfo="text",
            name="Hosts",
        )
    )

    # Routers trace
    fig.add_trace(
        go.Scatter(
            x=router_x,
            y=router_y,
            mode="markers+text",
            marker=dict(
                size=router_size,
                color=router_color,
                line=dict(width=2, color=router_border),
                symbol="circle",
            ),
            text=[n for n in G.nodes if G.nodes[n].get("type") != "host"],
            textposition="top center",
            textfont=dict(size=12, color="black"),
            hovertext=router_text,
            hoverinfo="text",
            name="Routers",
        )
    )

    # Highlight route annotation if exists
    if highlight_route:
        mid_idx = len(highlight_route) // 2
        if mid_idx < len(highlight_route):
            mid_node = highlight_route[mid_idx]
            mx, my = pos.get(mid_node, (0, 0))
            fig.add_annotation(
                x=mx,
                y=my + 0.3,
                text=f"Route: {' → '.join(highlight_route)}",
                showarrow=False,
                bgcolor="rgba(0,204,150,0.2)",
                bordercolor="#00CC96",
                font=dict(size=11),
            )

    fig.update_layout(
        title="Network Topology — Active Route Highlighted",
        showlegend=True,
        hovermode="closest",
        margin=dict(l=20, r=20, t=50, b=20),
        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        plot_bgcolor="white",
        height=500,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )

    return fig


def format_route(route: List[str]) -> str:
    return " → ".join(route) if route else "No route"


# ------------------------------------------------------------------
# Header
# ------------------------------------------------------------------
st.title("🌐 NetAdapt")
st.subheader("Adaptive and Self-Healing QoS-Based Network Routing System")
st.markdown(
    "*Interactive network simulation laboratory for adaptive routing, failure recovery, traffic analysis, and QoS experiments.*"
)

# ------------------------------------------------------------------
# Network Status
# ------------------------------------------------------------------
summary = sim.topology.summary()
latest_metrics = sim.metrics.get_latest() if sim.metrics.history else sim.metrics.calculate(sim.time, sim.average_congestion(), len(sim.active_flows))

col1, col2, col3, col4, col5, col6 = st.columns(6)
col1.metric("Total Nodes", summary["nodes"])
col2.metric("Active Nodes", summary["active_nodes"], delta=summary["active_nodes"] - summary["nodes"], delta_color="normal")
col3.metric("Total Links", summary["links"])
col4.metric("Active Links", summary["active_links"], delta=summary["active_links"] - summary["links"], delta_color="normal")
col5.metric("Active Flows", len(sim.active_flows))
col6.metric("Sim Time", f"{sim.time:.2f}s")

# Live metrics row
st.divider()
st.markdown("### 📊 Live Metrics")
m1, m2, m3, m4, m5, m6 = st.columns(6)
m1.metric("Avg Latency", f"{latest_metrics.get('average_latency', 0)*1000:.1f} ms")
m2.metric("Throughput", f"{latest_metrics.get('throughput', 0):.0f} B/s")
m3.metric("Packet Loss", f"{latest_metrics.get('packet_loss', 0):.1f}%")
m4.metric("PDR", f"{latest_metrics.get('packet_delivery_ratio', 0):.1f}%")
m5.metric("Congestion", f"{latest_metrics.get('congestion', 0):.1%}")
m6.metric("Recovery Time", f"{latest_metrics.get('recovery_time', 0):.2f}s")

# ------------------------------------------------------------------
# Main layout: Left controls, Right topology
# ------------------------------------------------------------------
left, right = st.columns([1, 2])

with left:
    st.markdown("### 🚦 Traffic Control")
    with st.container(border=True):
        nodes = sim.topology.nodes()
        hosts = [n for n in nodes if sim.topology.graph.nodes[n].get("type") == "host"]
        # Use all nodes but default to hosts
        source_options = nodes
        dest_options = nodes

        src = st.selectbox("Source", source_options, index=source_options.index(st.session_state.selected_source) if st.session_state.selected_source in source_options else 0, key="src_select")
        dst = st.selectbox("Destination", dest_options, index=dest_options.index(st.session_state.selected_dest) if st.session_state.selected_dest in dest_options else 2, key="dst_select")
        st.session_state.selected_source = src
        st.session_state.selected_dest = dst

        traffic_type = st.selectbox("Traffic Type", list(PRIORITIES.keys()), index=2)
        col_a, col_b = st.columns(2)
        packet_count = col_a.number_input("Packet Count", min_value=1, max_value=1000, value=20, step=1)
        packet_size = col_b.number_input("Packet Size (bytes)", min_value=64, max_value=9000, value=1000, step=100)

        col_c, col_d = st.columns(2)
        pps = col_c.number_input("Packets/sec", min_value=1.0, max_value=100.0, value=10.0, step=1.0)
        duration = col_d.number_input("Duration (s)", min_value=0.1, max_value=60.0, value=5.0, step=0.5)

        col_btn1, col_btn2 = st.columns(2)
        if col_btn1.button("Generate Traffic", type="primary", use_container_width=True):
            if src == dst:
                st.error("Source and destination must differ.")
            else:
                try:
                    flow = sim.create_flow(src, dst, traffic_type, packet_count, packet_size, pps, duration)
                    st.session_state.selected_flow_id = flow.flow_id
                    st.success(f"Flow {flow.flow_id} created: {src}→{dst} [{traffic_type}]")
                except Exception as e:
                    st.error(f"Failed to create flow: {e}")

        if col_btn2.button("Run Simulation", use_container_width=True):
            if len(sim.scheduler) == 0 and len(sim.active_flows) == 0:
                st.warning("No traffic to simulate. Generate traffic first.")
            else:
                processed = sim.run_until_empty()
                st.success(f"Processed {len(processed)} packets. Time: {sim.time:.2f}s")
                st.rerun()

        col_btn3, col_btn4 = st.columns(2)
        if col_btn3.button("Tick +1s", use_container_width=True):
            sim.tick(1.0)
            st.rerun()
        if col_btn4.button("Reset Simulation", use_container_width=True):
            sim.reset()
            st.session_state.selected_flow_id = None
            st.success("Simulation reset")
            st.rerun()

    st.markdown("### 💥 Fault Injection")
    with st.container(border=True):
        links = sim.topology.links()
        link_options = [f"{u}-{v}" for u, v in links]
        node_options = sim.topology.nodes()

        selected_link = st.selectbox("Select Link", link_options, key="link_select")
        col_f1, col_f2 = st.columns(2)
        if col_f1.button("Fail Link", use_container_width=True):
            try:
                u, v = selected_link.split("-")
                sim.fail_link(u, v)
                # Simulate detection after timeout by advancing time slightly and checking
                sim.tick(sim.failure_detection_timeout + 0.5)
                st.warning(f"Link {selected_link} failed. Detection after {sim.failure_detection_timeout}s")
                st.rerun()
            except Exception as e:
                st.error(str(e))

        if col_f2.button("Recover Link", use_container_width=True):
            try:
                u, v = selected_link.split("-")
                sim.recover_link(u, v)
                st.success(f"Link {selected_link} recovered")
                st.rerun()
            except Exception as e:
                st.error(str(e))

        selected_node = st.selectbox("Select Node", node_options, key="node_select")
        col_n1, col_n2 = st.columns(2)
        if col_n1.button("Fail Node", use_container_width=True):
            try:
                if selected_node in ("H1", "H2", "H3", "H4"):
                    st.warning("Failing a host will isolate it. Prefer router failures for rerouting demo.")
                sim.fail_node(selected_node)
                sim.tick(sim.failure_detection_timeout + 0.5)
                st.warning(f"Node {selected_node} failed")
                st.rerun()
            except Exception as e:
                st.error(str(e))
        if col_n2.button("Recover Node", use_container_width=True):
            try:
                sim.recover_node(selected_node)
                st.success(f"Node {selected_node} recovered")
                st.rerun()
            except Exception as e:
                st.error(str(e))

        st.divider()
        st.markdown("**Condition Injection**")
        col_c1, col_c2 = st.columns(2)
        congestion_val = col_c1.slider("Congestion", 0.0, 1.0, 0.0, 0.1, key="cong_slider")
        loss_val = col_c2.slider("Packet Loss", 0.0, 1.0, 0.0, 0.05, key="loss_slider")
        bw_val = st.slider("Bandwidth (Mbps)", 1.0, 100.0, 100.0, 5.0, key="bw_slider")

        col_cc1, col_cc2, col_cc3 = st.columns(3)
        if col_cc1.button("Set Congestion", use_container_width=True):
            try:
                u, v = selected_link.split("-")
                sim.set_congestion(u, v, congestion_val)
                st.info(f"Congestion on {selected_link} set to {congestion_val:.0%}")
                st.rerun()
            except Exception as e:
                st.error(str(e))
        if col_cc2.button("Set Loss", use_container_width=True):
            try:
                u, v = selected_link.split("-")
                sim.set_packet_loss(u, v, loss_val)
                st.info(f"Loss on {selected_link} set to {loss_val:.0%}")
                st.rerun()
            except Exception as e:
                st.error(str(e))
        if col_cc3.button("Set BW", use_container_width=True):
            try:
                u, v = selected_link.split("-")
                sim.set_bandwidth(u, v, bw_val)
                st.info(f"Bandwidth on {selected_link} set to {bw_val} Mbps")
                st.rerun()
            except Exception as e:
                st.error(str(e))

        if st.button("Reset Conditions", use_container_width=True):
            for u, v in sim.topology.links():
                sim.topology.update_link(u, v, congestion=0.0, packet_loss=0.0)
                orig_bw = sim.topology.get_original_bandwidth(u, v)
                sim.topology.update_link(u, v, bandwidth=orig_bw)
            st.success("Conditions reset")
            st.rerun()

    st.markdown("### 🛣️ Active Route")
    with st.container(border=True):
        try:
            route, cost, status = sim.get_current_route(st.session_state.selected_source, st.session_state.selected_dest)
            st.markdown(f"**Source:** {st.session_state.selected_source}")
            st.markdown(f"**Destination:** {st.session_state.selected_dest}")
            st.markdown(f"**Route:** {format_route(route)}")
            st.markdown(f"**Cost:** {cost:.2f}")
            if "FAILED" in status:
                st.error(f"Status: {status}")
            elif status == "REROUTED":
                st.warning(f"Status: {status}")
            else:
                st.success(f"Status: {status}")

            # Show selected flow details
            if st.session_state.selected_flow_id and st.session_state.selected_flow_id in sim.active_flows:
                flow = sim.active_flows[st.session_state.selected_flow_id]
                st.divider()
                st.markdown(f"**Selected Flow:** {flow.flow_id}")
                st.markdown(f"Type: {flow.traffic_type} | Size: {flow.packet_size}B")
                st.markdown(f"Sent: {flow.packets_sent} | Delivered: {flow.packets_delivered} | Dropped: {flow.packets_dropped}")
                st.markdown(f"Route Status: {flow.route_status}")
                st.markdown(f"Current Route: {format_route(flow.current_route)}")
                if flow.previous_route:
                    st.markdown(f"Previous Route: {format_route(flow.previous_route)}")

        except Exception as e:
            st.error(f"Route error: {e}")

    st.markdown("### 📋 Active Flows")
    with st.container(border=True):
        if sim.active_flows:
            flows_data = []
            for f in sim.active_flows.values():
                flows_data.append({
                    "Flow ID": f.flow_id,
                    "Source": f.source,
                    "Dest": f.destination,
                    "Type": f.traffic_type,
                    "Status": f.status,
                    "Route Status": f.route_status,
                    "Sent": f.packets_sent,
                    "Delivered": f.packets_delivered,
                    "Dropped": f.packets_dropped,
                    "Route": format_route(f.current_route),
                })
            df_flows = pd.DataFrame(flows_data)
            st.dataframe(df_flows, use_container_width=True, hide_index=True)

            # Flow selector for highlighting
            flow_ids = list(sim.active_flows.keys())
            selected = st.selectbox("Highlight Flow Route", ["None"] + flow_ids, key="flow_highlight")
            if selected != "None":
                st.session_state.selected_flow_id = selected
        else:
            st.info("No active flows. Generate traffic to create flows.")

with right:
    # Determine highlight route
    highlight_route = None
    if st.session_state.selected_flow_id and st.session_state.selected_flow_id in sim.active_flows:
        highlight_route = sim.active_flows[st.session_state.selected_flow_id].current_route
    else:
        try:
            r, _, _ = sim.get_current_route(st.session_state.selected_source, st.session_state.selected_dest)
            highlight_route = r
        except:
            highlight_route = None

    st.markdown("### 🗺️ Network Topology")
    fig = get_topology_figure(sim, highlight_route)
    st.plotly_chart(fig, use_container_width=True)

    # Link conditions table
    with st.expander("Link Conditions Details", expanded=False):
        link_data = []
        for u, v, data in sim.topology.graph.edges(data=True):
            link_data.append({
                "Link": f"{u}↔{v}",
                "Status": data.get("status", "UP"),
                "Latency (ms)": data.get("latency", 0),
                "Bandwidth (Mbps)": data.get("bandwidth", 0),
                "Loss": f"{data.get('packet_loss', 0):.2%}",
                "Congestion": f"{data.get('congestion', 0):.2%}",
                "Failed": "Yes" if tuple(sorted((u, v))) in sim._failed_links else "No",
            })
        st.dataframe(pd.DataFrame(link_data), use_container_width=True, hide_index=True)

    st.divider()
    st.markdown("### 📈 Performance Graphs")

    if sim.metrics.history:
        df_hist = sim.metrics.dataframe()

        # Latency graph
        fig_lat = go.Figure()
        fig_lat.add_trace(go.Scatter(x=df_hist["time"], y=df_hist["average_latency"]*1000, mode="lines+markers", name="Latency (ms)", line=dict(color="#636EFA")))
        fig_lat.update_layout(title="Latency Over Time", xaxis_title="Simulation Time (s)", yaxis_title="Latency (ms)", height=300, margin=dict(l=20, r=20, t=40, b=20))
        st.plotly_chart(fig_lat, use_container_width=True)

        col_g1, col_g2 = st.columns(2)
        with col_g1:
            fig_thr = go.Figure()
            fig_thr.add_trace(go.Scatter(x=df_hist["time"], y=df_hist["throughput"], mode="lines+markers", name="Throughput", line=dict(color="#00CC96")))
            fig_thr.update_layout(title="Throughput Over Time", xaxis_title="Time (s)", yaxis_title="Throughput (B/s)", height=300, margin=dict(l=20, r=20, t=40, b=20))
            st.plotly_chart(fig_thr, use_container_width=True)

            fig_loss = go.Figure()
            fig_loss.add_trace(go.Scatter(x=df_hist["time"], y=df_hist["packet_loss"], mode="lines+markers", name="Packet Loss %", line=dict(color="#EF553B")))
            fig_loss.update_layout(title="Packet Loss Over Time", xaxis_title="Time (s)", yaxis_title="Loss (%)", height=300, margin=dict(l=20, r=20, t=40, b=20))
            st.plotly_chart(fig_loss, use_container_width=True)

        with col_g2:
            fig_pdr = go.Figure()
            fig_pdr.add_trace(go.Scatter(x=df_hist["time"], y=df_hist["packet_delivery_ratio"], mode="lines+markers", name="PDR", line=dict(color="#AB63FA")))
            fig_pdr.update_layout(title="Packet Delivery Ratio Over Time", xaxis_title="Time (s)", yaxis_title="PDR (%)", height=300, margin=dict(l=20, r=20, t=40, b=20))
            st.plotly_chart(fig_pdr, use_container_width=True)

            fig_cong = go.Figure()
            fig_cong.add_trace(go.Scatter(x=df_hist["time"], y=df_hist["congestion"]*100, mode="lines+markers", name="Congestion %", line=dict(color="#FFA15A")))
            fig_cong.update_layout(title="Congestion Over Time", xaxis_title="Time (s)", yaxis_title="Congestion (%)", height=300, margin=dict(l=20, r=20, t=40, b=20))
            st.plotly_chart(fig_cong, use_container_width=True)

        # Before/After comparison
        st.markdown("#### Before / During / After Comparison")
        comparison = sim.metrics.get_comparison()
        if comparison.get("before") or comparison.get("during") or comparison.get("after"):
            comp_data = []
            for phase in ["before", "during", "after"]:
                if comparison.get(phase):
                    row = {"Phase": phase.capitalize()}
                    row.update(comparison[phase])
                    comp_data.append(row)
            if comp_data:
                df_comp = pd.DataFrame(comp_data)
                st.dataframe(df_comp, use_container_width=True, hide_index=True)

                # Bar chart comparison
                if len(comp_data) >= 2:
                    fig_comp = go.Figure()
                    metrics_to_compare = ["average_latency", "throughput", "packet_loss", "packet_delivery_ratio"]
                    for metric in metrics_to_compare:
                        vals = [c.get(metric, 0) for c in comp_data]
                        phases = [c["Phase"] for c in comp_data]
                        fig_comp.add_trace(go.Bar(name=metric, x=phases, y=vals))
                    fig_comp.update_layout(title="Performance Comparison", barmode="group", height=350)
                    st.plotly_chart(fig_comp, use_container_width=True)
        else:
            st.info("Run experiments with failures to see before/during/after comparison. Metrics history will be used.")

    else:
        st.info("No metrics history yet. Generate traffic and run simulation to see graphs.")

    st.divider()
    st.markdown("### 📜 Event Log")
    events = sim.get_event_log(limit=100)
    if events:
        # Format events for display
        df_events = pd.DataFrame(events)
        # Ensure time column exists
        if "time" in df_events.columns:
            df_events = df_events.sort_values("time", ascending=False)
        st.dataframe(df_events, use_container_width=True, hide_index=True)

        # Also show structured events
        with st.expander("Detailed Structured Events", expanded=False):
            structured = sim.get_structured_events(limit=50)
            for evt in reversed(structured[-20:]):
                st.markdown(f"`{evt.timestamp:.2f}s` **{evt.event_type}** — {evt.message} {f'[{evt.component}]' if evt.component else ''} {f'Flow:{evt.flow_id}' if evt.flow_id else ''}")
    else:
        st.info("No events yet.")

# ------------------------------------------------------------------
# Footer
# ------------------------------------------------------------------
st.divider()
st.markdown(
    """
    **Demonstration Scenario:**
    1. Observe topology
    2. Select Source=H1 Destination=H3
    3. Generate Video traffic (20 packets)
    4. Run Simulation → observe route, latency, PDR
    5. Introduce congestion on R1-R3 → check if route changes
    6. Fail link R3-R5 → observe failure detection after ~2s
    7. See route recalculation and traffic rerouted
    8. Check event log for failure, detection, recalculation, rerouting
    9. Observe changed metrics
    10. Recover link → continue simulation → compare before/after
    """
)

st.caption("NetAdapt — Simulation engine is source of truth. All metrics from real packet simulation. No fake data.")
