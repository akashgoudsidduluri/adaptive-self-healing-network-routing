import streamlit as st

from simulator import NetworkSimulator


st.set_page_config(
    page_title="NetAdapt",
    page_icon="🌐",
    layout="wide",
)

st.title("NetAdapt")
st.subheader("Adaptive and Self-Healing QoS-Based Network Routing System")

st.info("Stage 1 — Core Simulation Engine")

sim = NetworkSimulator(seed=42)
summary = sim.topology.summary()

col1, col2, col3 = st.columns(3)

col1.metric("Nodes", summary["nodes"])
col2.metric("Links", summary["links"])
col3.metric("Active Links", summary["active_links"])

st.divider()

st.write("### Simulation Engine Status")

st.success("Core simulation engine initialized successfully.")

st.write("### Network")

st.json(summary)

st.write("### Current Network")

for u, v, data in sim.topology.graph.edges(data=True):
    st.write(
        f"**{u} ↔ {v}** | "
        f"Latency: {data['latency']} ms | "
        f"Bandwidth: {data['bandwidth']} Mbps | "
        f"Loss: {data['packet_loss']:.2%} | "
        f"Congestion: {data['congestion']:.2%}"
    )