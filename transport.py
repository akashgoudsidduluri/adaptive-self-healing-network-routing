"""Simulated UDP and TCP transport services for NetAdapt.

Transport packets remain QoS packets in NetworkSimulator, so routing, scheduler,
loss, failure detection, packet movement, and metrics remain the source of truth.
"""
from __future__ import annotations
from copy import deepcopy
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional
from events import EventType
from qos import Packet

class TCPState(str, Enum):
    CLOSED="CLOSED"; SYN_SENT="SYN_SENT"; SYN_RECEIVED="SYN_RECEIVED"; ESTABLISHED="ESTABLISHED"
    FIN_WAIT="FIN_WAIT"; CLOSE_WAIT="CLOSE_WAIT"; LAST_ACK="LAST_ACK"; TIME_WAIT="TIME_WAIT"

@dataclass
class TransportPacket:
    protocol:str; source:str; destination:str; source_port:int; destination_port:int
    payload_size:int=0; flow_id:str=""; sequence_number:Optional[int]=None; acknowledgement_number:Optional[int]=None
    flags:List[str]=field(default_factory=list); window_size:int=0; kind:str="DATA"; traffic_class:str="HTTP"
    packet_id:Optional[int]=None; network_packet_id:Optional[int]=None; sent_time:float=0.0; delivered_time:Optional[float]=None
    status:str="ACTIVE"; route:List[str]=field(default_factory=list); retransmission:int=0; latency:Optional[float]=None; drop_reason:Optional[str]=None
    @property
    def label(self)->str:
        return "+".join(self.flags) if self.kind=="CONTROL" else ("ACK" if self.kind=="ACK" else ("FIN" if self.kind=="FIN" else "DATA"))
    def to_dict(self)->Dict[str,Any]:
        return {"id":self.packet_id,"packet_id":self.packet_id,"network_packet_id":self.network_packet_id,"protocol":self.protocol,"source":self.source,"destination":self.destination,"source_port":self.source_port,"destination_port":self.destination_port,"payload_size":self.payload_size,"flow_id":self.flow_id,"sequence_number":self.sequence_number,"acknowledgement_number":self.acknowledgement_number,"flags":list(self.flags),"window_size":self.window_size,"kind":self.kind,"traffic_class":self.traffic_class,"sent_time":self.sent_time,"delivered_time":self.delivered_time,"status":self.status,"route":list(self.route),"retransmission":self.retransmission,"latency":self.latency,"drop_reason":self.drop_reason}

@dataclass
class OutstandingSegment:
    sequence_number:int; packet:TransportPacket; send_time:float; retransmissions:int=0; timeout_started:bool=False

@dataclass
class UDPFlow:
    flow_id:str; source:str; destination:str; source_port:int; destination_port:int; traffic_class:str="VoIP"; payload_size:int=1000
    packets:List[TransportPacket]=field(default_factory=list); bytes_sent:int=0; bytes_delivered:int=0
    def to_dict(self)->Dict[str,Any]:
        return {"protocol":"UDP","flow_id":self.flow_id,"source":self.source,"destination":self.destination,"source_port":self.source_port,"destination_port":self.destination_port,"traffic_class":self.traffic_class,"payload_size":self.payload_size,"packets":[p.to_dict() for p in self.packets],"bytes_sent":self.bytes_sent,"bytes_delivered":self.bytes_delivered}

@dataclass
class TCPConnection:
    flow_id:str; source:str; destination:str; source_port:int; destination_port:int; traffic_class:str="HTTP"; state:TCPState=TCPState.CLOSED
    initial_cwnd:int=1; cwnd:float=1.; ssthresh:float=16.; receiver_window:int=8; sender_window:int=8; timeout:float=.1; rto:float=.1; srtt:Optional[float]=None; rttvar:float=0.
    rtt_samples:List[float]=field(default_factory=list); next_sequence:int=1; cumulative_ack:int=0; receiver_ack:int=0; outstanding:Dict[int,OutstandingSegment]=field(default_factory=dict); packets:List[TransportPacket]=field(default_factory=list)
    route:List[str]=field(default_factory=list); route_history:List[Dict[str,Any]]=field(default_factory=list); setup_started:float=0.; setup_completed:Optional[float]=None; ack_count:int=0; duplicate_ack_count:int=0; timeout_count:int=0; retransmission_count:int=0; max_cwnd:float=1.; cwnd_samples:List[float]=field(default_factory=list); congestion_phase:str="SLOW_START"; last_timeout_time:Optional[float]=None; state_history:List[Dict[str,Any]]=field(default_factory=list)
    @property
    def effective_window(self)->int: return max(0,int(min(self.cwnd,float(self.receiver_window))))
    def transition(self,state:TCPState,time:float,reason:str)->None: self.state=state; self.state_history.append({"time":time,"state":state.value,"reason":reason})
    def to_dict(self)->Dict[str,Any]:
        r=self.rtt_samples
        return {"protocol":"TCP","flow_id":self.flow_id,"source":self.source,"destination":self.destination,"source_port":self.source_port,"destination_port":self.destination_port,"traffic_class":self.traffic_class,"state":self.state.value,"state_history":list(self.state_history),"initial_cwnd":self.initial_cwnd,"cwnd":self.cwnd,"max_cwnd":self.max_cwnd,"average_cwnd":sum(self.cwnd_samples)/len(self.cwnd_samples) if self.cwnd_samples else self.cwnd,"ssthresh":self.ssthresh,"receiver_window":self.receiver_window,"sender_window":self.sender_window,"effective_window":self.effective_window,"packets_in_flight":len(self.outstanding),"outstanding_sequences":sorted(self.outstanding),"next_sequence":self.next_sequence,"cumulative_ack":self.cumulative_ack,"receiver_ack":self.receiver_ack,"ack_count":self.ack_count,"duplicate_ack_count":self.duplicate_ack_count,"timeout_count":self.timeout_count,"retransmission_count":self.retransmission_count,"current_rtt_ms":r[-1]*1000 if r else None,"average_rtt_ms":sum(r)/len(r)*1000 if r else None,"min_rtt_ms":min(r)*1000 if r else None,"max_rtt_ms":max(r)*1000 if r else None,"timeout":self.timeout,"rto":self.rto,"setup_time_ms":(self.setup_completed-self.setup_started)*1000 if self.setup_completed is not None else None,"route":list(self.route),"route_history":list(self.route_history),"packets":[p.to_dict() for p in self.packets]}

class TransportLayer:
    def __init__(self,simulator:Any): self.simulator=simulator; self.connections:Dict[str,TCPConnection]={}; self.udp_flows:Dict[str,UDPFlow]={}; self.packet_map:Dict[int,TransportPacket]={}; self._tcp=1; self._udp=1; self._packet=1
    def _log(self,event:EventType,message:str,connection:Optional[TCPConnection]=None,**details:Any): self.simulator._log_event(event,message,flow_id=connection.flow_id if connection else details.pop("flow_id",None),**details)
    def _endpoints(self,source:str,destination:str):
        if source not in self.simulator.topology.devices or destination not in self.simulator.topology.devices: raise ValueError("Transport source and destination must be existing devices")
        if source==destination: raise ValueError("Transport source and destination must differ")
    def _enqueue(self,p:TransportPacket)->TransportPacket:
        n=self.simulator.generate_packet(p.source,p.destination,p.traffic_class,max(1,p.payload_size),p.flow_id); p.packet_id=self._packet; self._packet+=1; p.network_packet_id=n.packet_id; p.sent_time=self.simulator.time
        n.transport=p; n.transport_protocol=p.protocol; n.transport_kind=p.kind; n.transport_flags=list(p.flags); n.transport_flow_id=p.flow_id; n.transport_sequence=p.sequence_number; n.transport_ack=p.acknowledgement_number; self.packet_map[n.packet_id]=p; return p
    def _control(self,c:TCPConnection,flags:List[str],kind:str,reverse:bool=False,seq:Optional[int]=None,ack:Optional[int]=None)->TransportPacket:
        source,destination=(c.destination,c.source) if reverse else (c.source,c.destination); sp,dp=(c.destination_port,c.source_port) if reverse else (c.source_port,c.destination_port)
        p=TransportPacket("TCP",source,destination,sp,dp,0,c.flow_id,seq,ack,list(flags),c.receiver_window,kind,c.traffic_class); c.packets.append(p); return self._enqueue(p)
    def create_tcp_connection(self,source:str,destination:str,source_port:int=5000,destination_port:int=8080,initial_cwnd:int=1,receiver_window:int=8,ssthresh:float=16.,timeout:float=.1,traffic_class:str="HTTP")->TCPConnection:
        self._endpoints(source,destination); fid=f"TCP-{self._tcp:03d}"; self._tcp+=1; c=TCPConnection(fid,source,destination,int(source_port),int(destination_port),traffic_class,TCPState.CLOSED,max(1,int(initial_cwnd)),max(1.,float(initial_cwnd)),max(1.,float(ssthresh)),max(1,int(receiver_window)),max(1,int(receiver_window)),max(.001,float(timeout)),max(.001,float(timeout)),setup_started=self.simulator.time); self.connections[fid]=c; c.transition(TCPState.CLOSED,self.simulator.time,"created"); self._log(EventType.TCP_CONNECTION_STARTED,f"TCP connection started {source}:{source_port} → {destination}:{destination_port}",c); c.transition(TCPState.SYN_SENT,self.simulator.time,"SYN"); syn=self._control(c,["SYN"],"CONTROL",seq=0); self._log(EventType.TCP_SYN_SENT,"TCP SYN sent",c,sequence_number=0,packet_id=syn.packet_id); return c
    def create_udp_flow(self,source:str,destination:str,source_port:int=5001,destination_port:int=8080,payload_size:int=1000,traffic_class:str="VoIP")->UDPFlow:
        self._endpoints(source,destination); fid=f"UDP-{self._udp:03d}"; self._udp+=1; f=UDPFlow(fid,source,destination,int(source_port),int(destination_port),traffic_class,int(payload_size)); self.udp_flows[fid]=f; self._log(EventType.UDP_FLOW_STARTED,f"UDP flow started {source}:{source_port} → {destination}:{destination_port}",flow_id=fid); return f
    def send_udp_data(self,flow_id:str,packet_count:int=1,payload_size:Optional[int]=None)->List[TransportPacket]:
        f=self.udp_flows[flow_id]; out=[]
        for _ in range(max(1,int(packet_count))):
            p=TransportPacket("UDP",f.source,f.destination,f.source_port,f.destination_port,int(payload_size or f.payload_size),f.flow_id,kind="DATA",traffic_class=f.traffic_class); f.packets.append(p); f.bytes_sent+=p.payload_size; out.append(self._enqueue(p)); self._log(EventType.UDP_DATA_SENT,"UDP data sent",flow_id=f.flow_id,packet_id=p.packet_id,payload_size=p.payload_size)
        return out
    def _ack(self,c:TCPConnection,ack:int): return self._control(c,["ACK"],"ACK",True,ack,ack)
    def send_tcp_data(self,flow_id:str,packet_count:int=1,payload_size:int=1000)->List[TransportPacket]:
        c=self.connections[flow_id]
        if c.state!=TCPState.ESTABLISHED: raise ValueError("TCP connection must be ESTABLISHED before sending data")
        out=[]
        for _ in range(min(max(0,int(packet_count)),max(0,c.effective_window-len(c.outstanding)))):
            seq=c.next_sequence; p=TransportPacket("TCP",c.source,c.destination,c.source_port,c.destination_port,int(payload_size),c.flow_id,seq,c.cumulative_ack,["ACK"],c.receiver_window,"DATA",c.traffic_class); c.packets.append(p); c.outstanding[seq]=OutstandingSegment(seq,p,self.simulator.time); c.next_sequence+=1; out.append(self._enqueue(p)); self._log(EventType.TCP_DATA_SENT,f"TCP data sent seq={seq}",c,sequence_number=seq,payload_size=payload_size,packet_id=p.packet_id)
        return out
    def close_tcp_connection(self,flow_id:str)->TransportPacket:
        c=self.connections[flow_id]
        if c.state not in {TCPState.ESTABLISHED,TCPState.CLOSE_WAIT}: raise ValueError("TCP connection cannot close from its current state")
        c.transition(TCPState.FIN_WAIT,self.simulator.time,"FIN"); p=self._control(c,["FIN","ACK"],"FIN",seq=c.next_sequence); self._log(EventType.TCP_FIN_SENT,"TCP FIN sent",c,sequence_number=c.next_sequence,packet_id=p.packet_id); return p
    def _route(self,c:TCPConnection,p:TransportPacket):
        if p.source==c.source and p.route and p.route!=c.route:
            old=list(c.route); c.route=list(p.route); c.route_history.append({"time":self.simulator.time,"route":list(p.route),"reason":"ROUTING_UPDATE"}); self._log(EventType.ROUTE_RECALCULATED,f"TCP route recalculated {c.source}→{c.destination}",c,old_route=old,new_route=list(p.route))
    def _rtt(self,c:TCPConnection,rtt:float):
        rtt=max(0.,rtt); c.rtt_samples.append(rtt)
        if c.srtt is None: c.srtt=rtt; c.rttvar=rtt/2
        else: c.rttvar=(3*c.rttvar+abs(c.srtt-rtt))/4; c.srtt=(7*c.srtt+rtt)/8
        c.rto=max(c.timeout,c.srtt+4*c.rttvar)
    def _process_ack(self,c:TCPConnection,p:TransportPacket):
        ack=int(p.acknowledgement_number or 0); old=c.cumulative_ack; c.ack_count+=1
        if ack<=old: c.duplicate_ack_count+=1
        keys=[seq for seq in c.outstanding if seq<ack]
        if keys:
            latest=max(keys); seg=c.outstanding.pop(latest,None)
            if seg: self._rtt(c,self.simulator.time-seg.send_time)
            for seq in keys: c.outstanding.pop(seq,None)
            c.cumulative_ack=max(c.cumulative_ack,ack)
            if c.cwnd<c.ssthresh: c.cwnd+=1; c.congestion_phase="SLOW_START"; self._log(EventType.TCP_SLOW_START,"TCP slow start increased cwnd",c,cwnd=c.cwnd)
            else: c.cwnd+=1/max(1.,c.cwnd); c.congestion_phase="CONGESTION_AVOIDANCE"; self._log(EventType.TCP_CONGESTION_AVOIDANCE,"TCP congestion avoidance increased cwnd",c,cwnd=c.cwnd)
            c.max_cwnd=max(c.max_cwnd,c.cwnd); c.cwnd_samples.append(c.cwnd); self._log(EventType.TCP_CONGESTION_WINDOW_CHANGED,f"TCP cwnd={c.cwnd:g}",c,cwnd=c.cwnd,phase=c.congestion_phase)
        self._log(EventType.TCP_ACK_RECEIVED,f"TCP ACK received ack={ack}",c,acknowledgement_number=ack,duplicate=ack<=old)
    def _retransmit(self,c:TCPConnection,seg:OutstandingSegment):
        o=seg.packet; p=TransportPacket("TCP",o.source,o.destination,o.source_port,o.destination_port,o.payload_size,o.flow_id,o.sequence_number,o.acknowledgement_number,list(o.flags),o.window_size,o.kind,o.traffic_class,retransmission=seg.retransmissions+1); c.packets.append(p); self._enqueue(p); seg.packet=p; seg.send_time=self.simulator.time; seg.timeout_started=False; c.retransmission_count+=1; self._log(EventType.TCP_RETRANSMISSION,f"TCP retransmission seq={p.sequence_number}",c,sequence_number=p.sequence_number,retransmission=p.retransmission,packet_id=p.packet_id)
    def process_transport_tick(self,now:Optional[float]=None)->List[TransportPacket]:
        current=self.simulator.time if now is None else float(now); out=[]
        for c in self.connections.values():
            for seg in list(c.outstanding.values()):
                if current-seg.send_time<c.rto: continue
                if not seg.timeout_started and (c.last_timeout_time is None or current-c.last_timeout_time>=c.rto):
                    seg.timeout_started=True; c.last_timeout_time=current; c.timeout_count+=1; c.ssthresh=max(2.0,c.cwnd/2); c.cwnd=1.0; c.congestion_phase="SLOW_START"; c.cwnd_samples.append(c.cwnd); self._log(EventType.TCP_TIMEOUT,f"TCP timeout seq={seg.sequence_number}",c,sequence_number=seg.sequence_number,rto=c.rto,packet_id=seg.packet.packet_id); self._log(EventType.TCP_CONGESTION_DETECTED,"TCP congestion detected; reducing cwnd",c,cwnd=c.cwnd,ssthresh=c.ssthresh); self._log(EventType.TCP_CONGESTION_WINDOW_CHANGED,f"TCP cwnd reduced to {c.cwnd:g}",c,cwnd=c.cwnd,ssthresh=c.ssthresh,phase=c.congestion_phase)
                self._retransmit(c,seg); out.append(seg.packet)
        return out
    def on_packet_processed(self,n:Packet):
        p=getattr(n,"transport",None)
        if p is None: return
        p.status=n.delivery_status; p.route=list(n.route); p.latency=n.latency; p.delivered_time=n.delivery_time
        if n.delivery_status=="DROPPED":
            ev=next((e for e in reversed(self.simulator.event_logger.events) if e.details.get("packet_id")==n.packet_id and e.event_type==EventType.PACKET_DROPPED),None); p.drop_reason=(ev.details.get("reason") if ev else None) or "DESTINATION_UNREACHABLE"
            if p.drop_reason=="PACKET_LOSS" and any(float(self.simulator.topology.graph[a][b].get("congestion",0))>0 for a,b in zip(p.route,p.route[1:]) if self.simulator.topology.graph.has_edge(a,b)): p.drop_reason="CONGESTION"
        c=self.connections.get(p.flow_id); f=self.udp_flows.get(p.flow_id)
        if c: self._route(c,p)
        self.simulator.transport_metrics.record(p.protocol,n.packet_id,p.sent_time,n.delivery_time,n.latency,n.size,n.delivery_status,p.flow_id,p.route,p.traffic_class)
        if p.protocol=="UDP":
            if n.delivery_status=="DELIVERED" and f: f.bytes_delivered+=p.payload_size
            return
        if c is None: return
        if n.delivery_status=="DROPPED":
            if p.kind=="DATA": self._log(EventType.TCP_PACKET_LOST,f"TCP packet lost seq={p.sequence_number}",c,sequence_number=p.sequence_number,reason=p.drop_reason,packet_id=p.packet_id)
            return
        if p.kind=="CONTROL" and p.flags==["SYN"]:
            c.transition(TCPState.SYN_RECEIVED,self.simulator.time,"SYN received"); self._control(c,["SYN","ACK"],"CONTROL",True,0,1); self._log(EventType.TCP_SYN_ACK_SENT,"TCP SYN-ACK sent",c,acknowledgement_number=1,packet_id=c.packets[-1].packet_id)
        elif p.kind=="CONTROL" and p.flags==["SYN","ACK"]:
            self._log(EventType.TCP_SYN_ACK_RECEIVED,"TCP SYN-ACK received",c,packet_id=p.packet_id); c.transition(TCPState.SYN_RECEIVED,self.simulator.time,"SYN-ACK received"); self._control(c,["ACK"],"CONTROL",seq=1,ack=1)
        elif p.kind=="CONTROL" and p.flags==["ACK"] and c.state==TCPState.SYN_RECEIVED:
            c.setup_completed=self.simulator.time; c.transition(TCPState.ESTABLISHED,self.simulator.time,"handshake complete"); self._log(EventType.TCP_ACK_RECEIVED,"TCP handshake ACK received",c,acknowledgement_number=p.acknowledgement_number,packet_id=p.packet_id); self._log(EventType.TCP_HANDSHAKE_COMPLETE,"TCP handshake complete",c,setup_time_ms=(c.setup_completed-c.setup_started)*1000,packet_id=p.packet_id)
        elif p.kind=="DATA" and p.payload_size:
            ack=int(p.sequence_number or 0)+1; c.receiver_ack=max(c.receiver_ack,ack); self._ack(c,ack); self._log(EventType.TCP_ACK_RECEIVED,f"TCP cumulative ACK queued ack={ack}",c,acknowledgement_number=ack,packet_id=p.packet_id)
        elif p.kind=="FIN":
            c.transition(TCPState.CLOSE_WAIT,self.simulator.time,"FIN received"); self._log(EventType.TCP_FIN_RECEIVED,"TCP FIN received",c,sequence_number=p.sequence_number,packet_id=p.packet_id); self._control(c,["ACK"],"CONTROL",True,c.receiver_ack,c.receiver_ack)
        elif p.kind=="ACK": self._process_ack(c,p)
        elif p.kind=="CONTROL" and "ACK" in p.flags and c.state in {TCPState.FIN_WAIT,TCPState.CLOSE_WAIT}:
            c.transition(TCPState.CLOSED,self.simulator.time,"close acknowledged"); self._log(EventType.TCP_CONNECTION_CLOSED,"TCP connection closed",c,packet_id=p.packet_id)
    def get_connection(self,fid:str): return self.connections.get(fid)
    def get_tcp_state(self,fid:str): return self.connections[fid].state.value if fid in self.connections else "CLOSED"
    def get_transport_flows(self): return [c.to_dict() for c in self.connections.values()]+[f.to_dict() for f in self.udp_flows.values()]
    def get_tcp_packet_info(self,pid:int): p=self.packet_map.get(int(pid)); return p.to_dict() if p else None
    def get_transport_statistics(self):
        tcp=self.simulator.transport_metrics.calculate("TCP",self.simulator.time,sum(c.retransmission_count for c in self.connections.values()),sum(c.timeout_count for c in self.connections.values()),sum((c.setup_completed-c.setup_started) for c in self.connections.values() if c.setup_completed is not None)); udp=self.simulator.transport_metrics.calculate("UDP",self.simulator.time); cs=[c.to_dict() for c in self.connections.values()]
        if cs: tcp.update({"current_cwnd":cs[-1]["cwnd"],"maximum_cwnd":max(x["max_cwnd"] for x in cs),"average_cwnd":sum(x["average_cwnd"] for x in cs)/len(cs),"ssthresh":cs[-1]["ssthresh"],"ack_count":sum(x["ack_count"] for x in cs),"duplicate_ack_count":sum(x["duplicate_ack_count"] for x in cs),"packets_in_flight":sum(x["packets_in_flight"] for x in cs)})
        return {"TCP":tcp,"UDP":udp,"connections":cs,"udp_flows":[f.to_dict() for f in self.udp_flows.values()]}
    def reset(self): self.connections.clear(); self.udp_flows.clear(); self.packet_map.clear(); self._tcp=1; self._udp=1; self._packet=1; self.simulator.transport_metrics.reset()

def compare_transport(simulator:Any,source:str,destination:str,packet_count:int=6,payload_size:int=1000,seed:Optional[int]=None)->Dict[str,Any]:
    from simulator import NetworkSimulator
    selected=int(simulator.seed if seed is None else seed); template=deepcopy(simulator.topology); results=[]
    for protocol in ("TCP","UDP"):
        run=NetworkSimulator(topology=deepcopy(template),seed=selected,scheduler=simulator.scheduler_name,scheduler_params=deepcopy(simulator.scheduler_params))
        if protocol=="TCP":
            c=run.create_tcp_connection(source,destination,traffic_class="HTTP"); run.run_until_empty(); run.rng.seed(selected+1000); sent=0; attempts=0
            while sent<packet_count and attempts<packet_count*8:
                attempts+=1; sent+=len(run.send_tcp_data(c.flow_id,packet_count-sent,payload_size)); run.run_until_empty()
                if c.outstanding and attempts<packet_count*8: run.tick(max(c.rto*1.1,.001)); run.run_until_empty()
            row=run.get_transport_statistics()["TCP"]; row.update({"protocol":"TCP","flow_id":c.flow_id,"state":c.state.value})
        else:
            f=run.create_udp_flow(source,destination,payload_size=payload_size,traffic_class="VoIP"); run.rng.seed(selected+1000); run.send_udp_data(f.flow_id,packet_count,payload_size); run.run_until_empty(); row=run.get_transport_statistics()["UDP"]; row.update({"protocol":"UDP","flow_id":f.flow_id,"state":"CONNECTIONLESS"})
        results.append(row)
    return {"type":"transport_comparison","source":source,"destination":destination,"seed":selected,"packet_count":packet_count,"payload_size":payload_size,"results":results}
