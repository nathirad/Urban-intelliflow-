"""
publisher.py — publish per-window metadata from one junction node to the city cloud.

Edge node → MQTT (Mosquitto) → (cloud bridge) → Kafka → Spark.
Only metadata is sent. Raw video never leaves the node.

Topic convention: intelliflow/<zone>/<junction>   e.g. intelliflow/A/MITR-01
"""
from __future__ import annotations

import json
import os

import paho.mqtt.client as mqtt

BROKER_HOST = os.getenv("MQTT_HOST", "localhost")
BROKER_PORT = int(os.getenv("MQTT_PORT", "1883"))
QOS = 1  # at-least-once; Kafka downstream dedups on (camera_id, timestamp)


class MqttPublisher:
    def __init__(self, host: str = BROKER_HOST, port: int = BROKER_PORT):
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        # TODO: enable TLS + username/password for ISO 27001 (encryption in transit)
        self.client.connect(host, port, keepalive=60)
        self.client.loop_start()

    def publish(self, payload: dict) -> None:
        topic = f"intelliflow/{payload['node_id']}/{payload['junction_id']}"
        self.client.publish(topic, json.dumps(payload, ensure_ascii=False), qos=QOS)

    def close(self) -> None:
        self.client.loop_stop()
        self.client.disconnect()
